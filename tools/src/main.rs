//! Developer tooling of the extension.

mod browser;
mod error;
mod launcher;
mod process;
mod profile;

use clap::{Parser, Subcommand};

#[derive(Debug, Parser)]
#[command(name = "devtool", version, about)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Builds the extension, sideloads it into an isolated browser and, on every save, reloads it
    /// and refreshes the open `YouTube` pages in place.
    Dev(launcher::DevArgs),
}

#[tokio::main]
async fn main() -> std::process::ExitCode {
    let Command::Dev(args) = Cli::parse().command;
    match Box::pin(launcher::run(args)).await {
        Ok(()) => std::process::ExitCode::SUCCESS,
        Err(error) => {
            launcher::log_event(&format!("Fatal: {error}"));
            std::process::ExitCode::FAILURE
        }
    }
}
