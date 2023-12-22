use std::{ops::Deref, path::PathBuf};

use dotset::{xdg_config_dir, Dummy, Package, Wizard};
use dotset_bin::{NerdFonts, Starship, Zpm, Zsh, ZshDependencies};

fn main() {
    let zsh_destination = xdg_config_dir().join("zsh");
    let zsh = Zsh::new(
        Some(&PathBuf::from("../zsh")),
        Some(&zsh_destination),
        vec![
            ZshDependencies::ZPM(Zpm::new(&zsh_destination)),
            ZshDependencies::Starship(Starship::new(NerdFonts::JetBrainsMono)),
        ],
    );
    let wizard = Wizard::new(zsh);
    wizard.setup();
    wizard.install();
    wizard.update();
}
