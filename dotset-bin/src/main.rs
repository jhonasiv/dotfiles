use std::{env, path::PathBuf, vec};

use clap::Parser;
use dotset::{dotset_instance, xdg_config_dir, DotsetCLI, Instance, Wizard};
use dotset_bin::{NerdFonts, Starship, Zpm, Zsh, ZshDependencies};

fn main() {
    let zsh_config = PathBuf::from(format!("{}/dotfiles/zsh", env!("HOME")));
    let zsh_destination = xdg_config_dir().join("zsh");
    let zsh_dependencies = vec![
        ZshDependencies::ZPM(Zpm::new(&zsh_destination)),
        ZshDependencies::Starship(Starship::new(NerdFonts::JetBrainsMono)),
    ];
    let zsh = Zsh::new(Some(&zsh_config), Some(&zsh_destination), zsh_dependencies);
    let zsh_wizard = Wizard::new(zsh);
    // let starship_wizard = Wizard::new(Starship::new(NerdFonts::JetBrainsMono));

    let dotfiles = Instance::new(vec![zsh_wizard]);

    let cli = DotsetCLI::parse();
    dotset_instance(dotfiles, cli)
}
