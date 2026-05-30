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
    #[command(subcommand)]
    Thread(ThreadCmd),
    #[command(subcommand)]
    Note(NoteCmd),
    #[command(subcommand)]
    Resource(ResourceCmd),
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

#[derive(Subcommand)]
pub enum ThreadCmd {
    /// Open a thread on a project.
    Add(ThreadAddArgs),
    /// List a project's threads, grouped by status.
    List {
        #[arg(long)]
        project: String,
    },
    /// Change a thread's status.
    Move {
        /// Ticket key, e.g. DEVOS-1.
        ticket_key: String,
        #[arg(long)]
        status: String,
    },
    /// Show a thread with its latest checkpoint and note history.
    Show {
        /// Ticket key, e.g. DEVOS-1.
        ticket_key: String,
    },
}

#[derive(Args)]
pub struct ThreadAddArgs {
    #[arg(long)]
    pub project: String,
    #[arg(long)]
    pub title: String,
    #[arg(long = "type")]
    pub type_: Option<String>,
    #[arg(long)]
    pub status: Option<String>,
    #[arg(long)]
    pub priority: Option<String>,
    #[arg(long)]
    pub branch: Option<String>,
}

#[derive(Subcommand)]
pub enum NoteCmd {
    /// Append a note to a thread.
    Add(NoteAddArgs),
}

#[derive(Args)]
pub struct NoteAddArgs {
    #[arg(long)]
    pub thread: String,
    #[arg(long)]
    pub body: String,
    #[arg(long)]
    pub kind: Option<String>,
    #[arg(long)]
    pub author: Option<String>,
    #[arg(long = "author-name")]
    pub author_name: Option<String>,
}

#[derive(Subcommand)]
pub enum ResourceCmd {
    /// Attach a resource to a project or thread.
    Add(ResourceAddArgs),
}

#[derive(Args)]
pub struct ResourceAddArgs {
    #[arg(long)]
    pub project: String,
    #[arg(long)]
    pub thread: Option<String>,
    #[arg(long = "type")]
    pub type_: String,
    #[arg(long)]
    pub label: String,
    #[arg(long)]
    pub value: String,
}
