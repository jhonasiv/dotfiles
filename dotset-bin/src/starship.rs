use std::{
    fmt::{Debug, Display},
    io::stdin,
    ops::Deref,
    process::Command,
    str,
};

use dotset::*;

use crate::NerdFonts;

#[derive(Clone)]
pub struct Starship {
    font: NerdFonts,
}

impl Starship {
    pub fn new(nerd_font: NerdFonts) -> Self {
        Self { font: nerd_font }
    }
}

impl Display for Starship {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Starship")
    }
}

impl Debug for Starship {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Starship {{ font: {} }}", self.font)
    }
}

impl DisplayablePackage for Starship {}

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

    fn dependencies(&self) -> Vec<Box<dyn DisplayablePackage>> {
        vec![Box::new(self.font.clone())]
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

impl Deref for Starship {
    type Target = dyn Package;

    fn deref(&self) -> &Self::Target {
        self as &dyn Package
    }
}
