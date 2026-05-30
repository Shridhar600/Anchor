use crate::audit;
use crate::cli::{ThreadAddArgs, ThreadCmd};
use crate::context::Context;
use crate::error::CliError;
use anchor_core::models::LookupRow;
use anchor_core::repository::{lookup, note, project, resource, thread};
use std::collections::HashMap;

pub fn handle(ctx: &mut Context, cmd: ThreadCmd) -> Result<i32, CliError> {
    match cmd {
        ThreadCmd::Add(a) => add(ctx, a),
        ThreadCmd::List { project } => list(ctx, &project),
        ThreadCmd::Move { ticket_key, status } => move_status(ctx, &ticket_key, &status),
        ThreadCmd::Show { ticket_key } => show(ctx, &ticket_key),
    }
}

fn label_map(rows: Vec<LookupRow>) -> HashMap<i64, String> {
    rows.into_iter().map(|r| (r.id, r.label)).collect()
}

fn add(ctx: &mut Context, a: ThreadAddArgs) -> Result<i32, CliError> {
    let proj = project::get_by_key(&ctx.db.conn, &a.project)?;
    let type_id = lookup::id_for_key(
        &ctx.db.conn,
        "thread_types",
        a.type_.as_deref().unwrap_or("feature"),
    )?;
    let status_id = lookup::id_for_key(
        &ctx.db.conn,
        "statuses",
        a.status.as_deref().unwrap_or("backlog"),
    )?;
    let priority_id = lookup::id_for_key(
        &ctx.db.conn,
        "priorities",
        a.priority.as_deref().unwrap_or("med"),
    )?;
    let t = thread::create(
        &mut ctx.db.conn,
        thread::NewThread {
            project_id: proj.id,
            title: a.title,
            description: None,
            type_id,
            status_id,
            priority_id,
            git_branch: a.branch,
        },
    )?;
    audit::record(
        ctx,
        "thread.add",
        Some("thread"),
        Some(&t.ticket_key),
        &format!("{} created: {}", t.ticket_key, t.title),
    )?;
    if ctx.json {
        crate::output::emit_json(&t)?;
    } else {
        println!("Opened {}: {}", t.ticket_key, t.title);
    }
    Ok(0)
}

fn list(ctx: &Context, project_key: &str) -> Result<i32, CliError> {
    let proj = project::get_by_key(&ctx.db.conn, project_key)?;
    let threads = thread::list_by_project(&ctx.db.conn, proj.id)?;
    if ctx.json {
        crate::output::emit_json(&threads)?;
    } else if threads.is_empty() {
        println!("No threads in {}.", proj.key);
    } else {
        let statuses = lookup::global_statuses(&ctx.db.conn)?;
        for s in &statuses {
            let group: Vec<_> = threads.iter().filter(|t| t.status_id == s.id).collect();
            if group.is_empty() {
                continue;
            }
            println!("{}:", s.label);
            for t in group {
                println!("  {}  {}", t.ticket_key, t.title);
            }
        }
    }
    Ok(0)
}

fn move_status(ctx: &Context, ticket_key: &str, status_key: &str) -> Result<i32, CliError> {
    let t = thread::get_by_ticket_key(&ctx.db.conn, ticket_key)?;
    let status_id = lookup::id_for_key(&ctx.db.conn, "statuses", status_key)?;
    thread::update_status(&ctx.db.conn, t.id, status_id)?;
    audit::record(
        ctx,
        "thread.move",
        Some("thread"),
        Some(ticket_key),
        &format!("{ticket_key} -> {status_key}"),
    )?;
    if ctx.json {
        let updated = thread::get(&ctx.db.conn, t.id)?;
        crate::output::emit_json(&updated)?;
    } else {
        println!("Moved {ticket_key} to {status_key}");
    }
    Ok(0)
}

fn show(ctx: &Context, ticket_key: &str) -> Result<i32, CliError> {
    let t = thread::get_by_ticket_key(&ctx.db.conn, ticket_key)?;
    let notes = note::list_by_thread(&ctx.db.conn, t.id)?;
    let checkpoint = note::latest_checkpoint(&ctx.db.conn, t.id)?;
    let resources = resource::list_by_thread(&ctx.db.conn, t.id)?;
    if ctx.json {
        let view = serde_json::json!({
            "thread": t,
            "latest_checkpoint": checkpoint,
            "notes": notes,
            "resources": resources,
        });
        crate::output::emit_json(&view)?;
    } else {
        let types = label_map(lookup::thread_types(&ctx.db.conn)?);
        let stats = label_map(lookup::global_statuses(&ctx.db.conn)?);
        let prios = label_map(lookup::priorities(&ctx.db.conn)?);
        let dash = "-".to_string();
        println!("{}  {}", t.ticket_key, t.title);
        println!(
            "type: {} | status: {} | priority: {}",
            types.get(&t.type_id).unwrap_or(&dash),
            stats.get(&t.status_id).unwrap_or(&dash),
            prios.get(&t.priority_id).unwrap_or(&dash),
        );
        if let Some(b) = &t.git_branch {
            println!("branch: {b}");
        }
        if let Some(d) = &t.description {
            println!("\n{d}");
        }
        if let Some(cp) = &checkpoint {
            println!("\nLatest checkpoint ({}): {}", cp.created_at, cp.body);
        }
        println!("\nNotes ({}):", notes.len());
        for n in &notes {
            let who = n
                .author_name
                .clone()
                .unwrap_or_else(|| n.author.as_str().to_string());
            println!("  [{}] {}: {}", n.created_at, who, n.body);
        }
        if !resources.is_empty() {
            println!("\nResources ({}):", resources.len());
            for r in &resources {
                println!("  [{}] {}", r.label, r.value);
            }
        }
    }
    Ok(0)
}
