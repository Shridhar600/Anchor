use crate::audit;
use crate::cli::{ProjectAddArgs, ProjectCmd};
use crate::context::Context;
use crate::error::CliError;
use anchor_core::models::ProjectStatus;
use anchor_core::repository::{project, resource, thread};

pub fn handle(ctx: &mut Context, cmd: ProjectCmd) -> Result<i32, CliError> {
    match cmd {
        ProjectCmd::Add(args) => add(ctx, args),
        ProjectCmd::List => list(ctx),
        ProjectCmd::Show { key } => show(ctx, &key),
    }
}

fn add(ctx: &Context, a: ProjectAddArgs) -> Result<i32, CliError> {
    let p = project::create(
        &ctx.db.conn,
        project::NewProject {
            key: a.key,
            name: a.name,
            description: a.desc,
            local_path: a.path,
            git_remote: a.remote,
            status: ProjectStatus::Active,
        },
    )?;
    audit::record(
        ctx,
        "project.add",
        Some("project"),
        Some(&p.key),
        &format!("{} created: {}", p.key, p.name),
    )?;
    if ctx.json {
        println!("{}", serde_json::to_string_pretty(&p).expect("serialize"));
    } else {
        println!("Created project {} ({})", p.key, p.name);
    }
    Ok(0)
}

fn list(ctx: &Context) -> Result<i32, CliError> {
    let projects = project::list(&ctx.db.conn)?;
    if ctx.json {
        println!(
            "{}",
            serde_json::to_string_pretty(&projects).expect("serialize")
        );
    } else if projects.is_empty() {
        println!("No projects yet.");
    } else {
        for p in &projects {
            println!("{:<10} {}  [{}]", p.key, p.name, p.status.as_str());
        }
    }
    Ok(0)
}

fn show(ctx: &Context, key: &str) -> Result<i32, CliError> {
    let p = project::get_by_key(&ctx.db.conn, key)?;
    let threads = thread::list_by_project(&ctx.db.conn, p.id)?;
    let resources = resource::list_by_project(&ctx.db.conn, p.id)?;
    if ctx.json {
        let view = serde_json::json!({
            "project": p,
            "threads": threads,
            "resources": resources,
        });
        println!(
            "{}",
            serde_json::to_string_pretty(&view).expect("serialize")
        );
    } else {
        println!("{} — {}  [{}]", p.key, p.name, p.status.as_str());
        if let Some(d) = &p.description {
            println!("{d}");
        }
        println!("\nThreads ({}):", threads.len());
        for t in &threads {
            println!("  {}  {}", t.ticket_key, t.title);
        }
        println!("\nResources ({}):", resources.len());
        for r in &resources {
            let scope = if r.thread_id.is_some() {
                "thread"
            } else {
                "project"
            };
            println!("  [{scope}] {} -> {}", r.label, r.value);
        }
    }
    Ok(0)
}
