use std::{
    fs::{create_dir, remove_dir_all, File},
    io::Write,
    path::PathBuf,
};

use dotset::*;
use git2::Repository;

#[derive(Clone)]
pub struct Zpm {
    zpm_destination: PathBuf,
}

impl Zpm {
    pub fn new(zsh_destination: &PathBuf) -> Self {
        Zpm {
            zpm_destination: zsh_destination.join(".zpm"),
        }
    }
}

impl DisplayablePackage for Zpm {
    fn display(&self) -> String {
        String::from("ZPM")
    }

    fn debug(&self) -> String {
        format!("ZPM {{ {} }}", self.zpm_destination.display())
    }
}

impl Package for Zpm {
    fn install(&self, _interactive: bool) {
        let clone_options = CloneOptionsBuilder::new().recursive(true).build();
        default_clone(
            "https://github.com/zpm-zsh/zpm",
            self.zpm_destination.to_owned(),
            clone_options,
        )
        .unwrap();
    }

    fn uninstall(&self, _interactive: bool) {
        remove_dir_all(&self.zpm_destination).unwrap()
    }

    fn update(&self) {
        let repo = Repository::open(&self.zpm_destination).expect(
            format!(
                "{} should be a git repository",
                self.zpm_destination.display()
            )
            .as_str(),
        );
        fast_forward_merge(repo, "origin", "main");
    }

    fn is_installed(&self) -> bool {
        which("zpm").is_some() || self.zpm_destination.exists()
    }

    fn name(&self) -> String {
        String::from("zpm")
    }
}

pub struct Zsh {
    config: Option<PathBuf>,
    destination: Option<PathBuf>,
    selector: Selector,
}

impl Zsh {
    pub fn new(config: Option<&PathBuf>, destination: Option<&PathBuf>) -> Self {
        let selector = Selector::new(vec![SupportedPackageManager::APT]);
        Self {
            config: config.cloned(),
            destination: destination.cloned(),
            selector,
        }
    }

    pub fn create_base_zshenv_file() {
        let content = "export ZDOTDIR=$HOME/.config/zsh\n\
            source $ZDOTDIR/.zshenv";
        let mut file = File::create(format!("{}/.zshenv", env!("HOME"))).unwrap();
        file.write(content.as_bytes()).unwrap();
    }
}

impl DisplayablePackage for Zsh {
    fn display(&self) -> String {
        String::from("ZSH")
    }

    fn debug(&self) -> String {
        let config = self.config.clone().unwrap_or(PathBuf::new());
        let dst = self.destination.clone().unwrap_or(PathBuf::new());
        format!(
            "ZSH {{ config: {}, dst: {} }}",
            config.display(),
            dst.display()
        )
    }
}

impl Package for Zsh {
    fn name(&self) -> String {
        String::from("zsh")
    }

    fn is_installed(&self) -> bool {
        which("zsh").is_some()
    }

    fn install(&self, _interactive: bool) {
        self.selector.install("zsh").unwrap();
    }

    fn post_install(&self, _interactive: bool) {
        match (&self.config, &self.destination) {
            (Some(conf), Some(dst)) => {
                if !dst.exists() {
                    println!("Creating zsh folder at {}", conf.display());
                    create_dir(&dst).unwrap();
                }
                link_all_files_and_directories_from_folder(&conf, &dst);
            },
            _ => (),
        };

        Self::create_base_zshenv_file();
        let zsh_path = which("zsh").unwrap();
        chsh(zsh_path.as_str(), None);
        println!("ZSH is now set as your default shell. A logout is necessary for it to take effect");
    }

    fn update(&self) {
        self.selector.update("zsh").unwrap();
    }

    fn uninstall(&self, _interactive: bool) {
        self.selector.uninstall("zsh").unwrap();
    }
}
