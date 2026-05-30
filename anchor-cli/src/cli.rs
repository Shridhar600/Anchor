use clap::{Args, Parser, Subcommand};

#[derive(Parser)]
#[command(name = "anchor", about = "Local dev project & thread tracker")]
pub struct Cli {
    #[arg(long, global = true)]
    pub db: Option<String>,

    #[arg(long, global = true)]
    pub actor: Option<String>,

    #[arg(long, global = true)]
    pub json: bool,

    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand)]
pub enum Commands {
    #[command(subcommand)]
    Project(ProjectCmd),
}

#[derive(Subcommand)]
pub enum ProjectCmd {
    Add(ProjectAddArgs),
    List,
    Show { key: String },
}

#[derive(Args)]
pub struct ProjectAddArgs {
    #[arg(long)]
    pub key: String,
    #[arg(long)]
    pub name: String,
    #[arg(long)]
    pub desc: Option<String>,
    #[arg(long)]
    pub path: Option<String>,
    #[arg(long)]
    pub remote: Option<String>,
}
