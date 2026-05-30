use crate::context::Context;
use crate::error::CliError;
use anchor_core::repository::command_log::{self, NewLogEntry};

pub fn record(
    ctx: &Context,
    command: &str,
    target_type: Option<&str>,
    target_id: Option<&str>,
    summary: &str,
) -> Result<(), CliError> {
    command_log::record(
        &ctx.db.conn,
        NewLogEntry {
            actor: ctx.actor.clone(),
            command: command.to_string(),
            target_type: target_type.map(|s| s.to_string()),
            target_id: target_id.map(|s| s.to_string()),
            summary: summary.to_string(),
        },
    )?;
    Ok(())
}
