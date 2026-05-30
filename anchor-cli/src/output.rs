use crate::error::CliError;

pub fn emit_json<T: serde::Serialize>(value: &T) -> Result<(), CliError> {
    println!("{}", serde_json::to_string_pretty(value)?);
    Ok(())
}
