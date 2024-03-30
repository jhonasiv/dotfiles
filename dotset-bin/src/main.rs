use std::{env, path::PathBuf, vec};

use clap::Parser;
use dotset::{
    dotset_instance, wizard, xdg_config_dir, Dependency, DotsetCLI, Instance, Wizard,
};
use dotset_bin::{zoxide, Neovim, NerdFonts, Starship, Zoxide, Zpm, Zsh};

fn main() {
    let zsh_config = PathBuf::from(format!("{}/dotfiles/zsh", env!("HOME")));
    let zsh_destination = xdg_config_dir().join("zsh");
    let zsh = &Dependency::new(
        Box::new(Zsh::new(Some(&zsh_config), Some(&zsh_destination))),
        true,
    );
    let zpm = &Dependency::new(Box::new(Zpm::new(&zsh_destination)), true);
    let zpm_wizard = Wizard::new(zpm);

    let nerd_font = &Dependency::new(Box::new(NerdFonts::JetBrainsMono), true);
    let nerd_font_wizard = Wizard::new(nerd_font);
    let starship = &Dependency::new(Box::new(Starship::new()), false);
    let starship_wizard = Wizard::new(starship).depends_on(&nerd_font_wizard);

    let zoxide = Zoxide::new();
    let zoxide_wiz = wizard!(zoxide, false);
    // let zoxide = &Dependency::new(Box::new(Zoxide::new()), false);
    // let zoxide_wizard = Wizard::new(zoxide);

    let zsh_wizard = Wizard::new(zsh)
        .depends_on(&zpm_wizard)
        .depends_on(&starship_wizard)
        .depends_on(&zoxide_wiz);

    let neovim = Neovim::new(
        PathBuf::from(format!("{}/.local/share/neovim", env!("HOME"))),
        Some(PathBuf::from(format!("{}/.local", env!("HOME")))),
        Some(PathBuf::from(format!("{}/dotfiles/nvim", env!("HOME")))),
        Some(PathBuf::from(format!("{}/.config/nvim", env!("HOME")))),
        None,
    );
    // let neovim_wizard = Wizard::new(neovim);

    let dotfiles = Instance::new(vec![&zsh_wizard]);

    let cli = DotsetCLI::parse();
    dotset_instance(dotfiles, cli)
}
