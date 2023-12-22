use std::{fs::remove_file, io::stdin, ops::Deref, path::PathBuf, process::Command};

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

impl Package for Starship {
    fn install(&self) {
        println!("Starship is installed by running a script that's downloaded from the internet...Before proceeding, you should make sure the script doesnt contain malicious code. Check the link https://github.com/starship/starship/blob/master/install/install.sh. Press any key to continue");
        let mut buffer = String::new();
        stdin().read_line(&mut buffer).unwrap();
        let data = Curl::download("https://starship.rs/install.sh", None);
        let string_data = String::from_utf8(data).unwrap();
        Command::new("sh").arg(string_data).status().unwrap();
    }

    fn update(&self) {
        self.install();
    }

    fn dependencies(&self) -> Vec<Box<dyn Package>> {
        vec![Box::new(self.font.clone())]
    }

    fn is_installed(&self) -> bool {
        which("starship").is_some()
    }

    fn name(&self) -> String {
        String::from("starship")
    }

    fn uninstall(&self) {
        if self.is_installed() {
            remove_file(PathBuf::from("/usr/local/bin/starship")).unwrap();
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
