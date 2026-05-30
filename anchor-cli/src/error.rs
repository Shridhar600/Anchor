use std::fmt;

#[derive(Debug)]
pub enum CliError {
    Core(anchor_core::AnchorError),
    Io(std::io::Error),
    Serialize(serde_json::Error),
}

impl CliError {
    pub fn exit_code(&self) -> i32 {
        match self {
            CliError::Core(anchor_core::AnchorError::NotFound(_)) => 2,
            _ => 1,
        }
    }
}

impl fmt::Display for CliError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CliError::Core(e) => write!(f, "{e}"),
            CliError::Io(e) => write!(f, "{e}"),
            CliError::Serialize(e) => write!(f, "{e}"),
        }
    }
}

impl From<anchor_core::AnchorError> for CliError {
    fn from(e: anchor_core::AnchorError) -> Self {
        CliError::Core(e)
    }
}

impl From<std::io::Error> for CliError {
    fn from(e: std::io::Error) -> Self {
        CliError::Io(e)
    }
}

impl From<serde_json::Error> for CliError {
    fn from(e: serde_json::Error) -> Self {
        CliError::Serialize(e)
    }
}
