use crate::audit;
use crate::cli::{ResourceAddArgs, ResourceCmd};
use crate::context::Context;
use crate::error::CliError;
use anchor_core::repository::{lookup, project, resource, thread};

pub fn handle(ctx: &mut Context, cmd: ResourceCmd) -> Result<i32, CliError> {
    match cmd {
        ResourceCmd::Add(a) => add(ctx, a),
    }
}

fn add(ctx: &mut Context, a: ResourceAddArgs) -> Result<i32, CliError> {
    let proj = project::get_by_key(&ctx.db.conn, &a.project)?;
    let thread_id = match &a.thread {
        Some(tk) => Some(thread::get_by_ticket_key(&ctx.db.conn, tk)?.id),
        None => None,
    };
    let type_id = lookup::id_for_key(&ctx.db.conn, "resource_types", &a.type_)?;
    let r = resource::add(
        &mut ctx.db.conn,
        resource::NewResource {
            project_id: proj.id,
            thread_id,
            type_id,
            label: a.label,
            value: a.value,
        },
    )?;
    let target = a.thread.clone().unwrap_or_else(|| a.project.clone());
    if ctx.json {
        crate::output::emit_json(&r)?;
    } else {
        println!("Added resource '{}'", r.label);
    }
    audit::record(
        ctx,
        "resource.add",
        Some("resource"),
        Some(&target),
        &format!("resource '{}' added", r.label),
    )?;
    Ok(0)
}
