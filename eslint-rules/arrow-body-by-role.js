/**
 * Picks an arrow function's body by what the arrow is for:
 *
 * A closure handed back by a `return` takes braces, so the function it builds reads as a function:
 *
 *   return player => {
 *     return seekNatively({ player, seconds });
 *   };
 *
 * Every other arrow (an object property's value, a callback) whose body is a lone `return` drops the braces:
 *
 *   manifest: ({ browser }) => ({ ... })
 *   bindings.filter(binding => binding.isSphericalOnly)
 *
 * It replaces oxlint's arrow-body-style "as-needed", which can't make the returned-closure exception.
 */

function isReturnedClosure(node) {
  return node.parent.type === "ReturnStatement";
}

function getLoneReturnArgument(body) {
  const [statement] = body.body;
  const isLoneReturn = body.body.length === 1 && statement.type === "ReturnStatement" && statement.argument !== null;
  return isLoneReturn ? statement.argument : null;
}

// An object literal (or a comma sequence) as an arrow's expression body has to be parenthesized
function needsParentheses(expression) {
  return expression.type === "ObjectExpression" || expression.type === "SequenceExpression";
}

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "suggestion",
    fixable: "code",
    schema: [],
    messages: {
      returnedClosureBraces: "A returned closure takes braces and a `return`.",
      unexpectedBraces: "Drop the braces and `return` - this arrow only hands back a value."
    }
  },
  create: context => ({
    ArrowFunctionExpression(node) {
      const isBlockBody = node.body.type === "BlockStatement";
      if (isReturnedClosure(node)) {
        if (!isBlockBody) {
          context.report({
            node: node.body,
            messageId: "returnedClosureBraces"
          });
        }

        return;
      }

      const returnArgument = isBlockBody ? getLoneReturnArgument(node.body) : null;
      if (!returnArgument) {
        return;
      }

      const { sourceCode } = context;
      const isCommented = sourceCode.getCommentsInside(node.body).length > 0;
      context.report({
        node: node.body,
        messageId: "unexpectedBraces",
        fix: isCommented ? null : fixer => {
          const expressionText = sourceCode.getText(returnArgument);
          const bodyText = needsParentheses(returnArgument) ? `(${expressionText})` : expressionText;
          return fixer.replaceText(node.body, bodyText);
        }
      });
    }
  })
};
