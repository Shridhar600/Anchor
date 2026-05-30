use crate::audit;
use crate::cli::{NoteAddArgs, NoteCmd};
use crate::context::Context;
use crate::error::CliError;
use anchor_core::models::NoteAuthor;
use anchor_core::repository::{lookup, note, thread};

pub fn handle(ctx: &mut Context, cmd: NoteCmd) -> Result<i32, CliError> {
    match cmd {
        NoteCmd::Add(a) => add(ctx, a),
    }
}

fn add(ctx: &mut Context, a: NoteAddArgs) -> Result<i32, CliError> {
    let t = thread::get_by_ticket_key(&ctx.db.conn, &a.thread)?;
    let kind_id = lookup::id_for_key(
        &ctx.db.conn,
        "note_kinds",
        a.kind.as_deref().unwrap_or("log"),
    )?;
    let author = match a.author.as_deref() {
        Some(s) => s.parse()?,
        None => {
            if ctx.actor != "cli" {
                NoteAuthor::Agent
            } else {
                NoteAuthor::User
            }
        }
    };
    let author_name = a.author_name.clone().or_else(|| {
        if author == NoteAuthor::Agent {
            Some(ctx.actor.clone())
        } else {
            None
        }
    });
    let n = note::add(
        &mut ctx.db.conn,
        note::NewNote {
            thread_id: t.id,
            author,
            author_name,
            kind_id,
            body: a.body,
        },
    )?;
    if ctx.json {
        crate::output::emit_json(&n)?;
    } else {
        println!("Added note to {}", a.thread);
    }
    audit::record(
        ctx,
        "note.add",
        Some("thread"),
        Some(&a.thread),
        &format!("note on {}", a.thread),
    )?;
    Ok(0)
}
