mod audit;
mod cli;
mod commands;
mod context;
mod error;

use clap::Parser;

fn main() {
    let parsed = cli::Cli::parse();
    match run(parsed) {
        Ok(code) => std::process::exit(code),
        Err(e) => {
            eprintln!("error: {e}");
            std::process::exit(e.exit_code());
        }
    }
}

fn run(parsed: cli::Cli) -> Result<i32, error::CliError> {
    let mut ctx = context::Context::new(parsed.db, parsed.actor, parsed.json)?;
    match parsed.command {
        cli::Commands::Project(cmd) => commands::project::handle(&mut ctx, cmd),
        cli::Commands::Thread(cmd) => commands::thread::handle(&mut ctx, cmd),
        cli::Commands::Note(cmd) => commands::note::handle(&mut ctx, cmd),
        cli::Commands::Resource(cmd) => commands::resource::handle(&mut ctx, cmd),
    }
}
