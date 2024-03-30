use std::{io::stdin, process::Command, str};

use dotset::*;

#[derive(Clone)]
pub struct Starship {}

impl Starship {
    pub fn new() -> Self {
        Self {}
    }
}

impl DisplayablePackage for Starship {
    fn display(&self) -> String {
        String::from("Starship")
    }

    fn debug(&self) -> String {
        format!("Starhsip")
    }
}

impl Package for Starship {
    fn install(&self, _interactive: bool) {
        println!("Starship is installed by running a script that's downloaded from the internet...Before proceeding, you should make sure the script doesnt contain malicious code. Check the link https://github.com/starship/starship/blob/master/install/install.sh. Press any key to continue");
        let mut buffer = String::new();
        stdin().read_line(&mut buffer).unwrap();
        let data = Curl::download("https://starship.rs/install.sh", None);
        Command::new("sh")
            .args(vec!["-c", str::from_utf8(&data).unwrap()])
            .status()
            .unwrap();
    }

    fn update(&self) {
        self.install(false);
    }

    fn is_installed(&self) -> bool {
        which("starship").is_some()
    }

    fn name(&self) -> String {
        String::from("starship")
    }

    fn uninstall(&self, _interactive: bool) {
        if self.is_installed() {
            Command::new("sudo")
                .args(vec!["rm", "/usb/local/bin/starship"])
                .status()
                .unwrap();
            return;
        }
        println!("Could not find a starship instance in your system. Are you sure it's installed?");
    }
}
