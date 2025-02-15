use std::{process::Command, str};

use dotset::{which, Curl, DisplayablePackage, Package};

#[derive(Clone)]
pub struct Zoxide {}

impl Zoxide {
    pub fn new() -> Self {
        Self {}
    }
}

impl Package for Zoxide {
    fn name(&self) -> String {
        String::from("Zoxide")
    }

    fn is_installed(&self) -> bool {
        which("zoxide").is_some()
    }

    fn install(&self, _interactive: bool) {
        let data = Curl::download(
            "https://raw.githubusercontent.com/ajeetdsouza/zoxide/main/install.sh",
            None,
        );
        Command::new("sh")
            .args(vec!["-c", str::from_utf8(&data).unwrap()])
            .status()
            .unwrap();
    }
}

impl DisplayablePackage for Zoxide {
    fn display(&self) -> String {
        String::from("Zoxide")
    }

    fn debug(&self) -> String {
        String::from("Zoxide")
    }
}
