use std::{
    fmt::format,
    fs::{create_dir, remove_dir_all, remove_file, File},
    io::Write,
    ops::Deref,
    os::unix::fs::symlink,
    path::{Path, PathBuf},
};

use dotset::*;
use walkdir::WalkDir;

use crate::{NerdFonts, Starship};

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

impl Package for Zpm {
    fn install(&self) {
        let clone_options = CloneOptionsBuilder::new().recursive(true).build();
        default_clone(
            "https://github.com/zpm-zsh/zpm",
            self.zpm_destination.to_owned(),
            clone_options,
        )
        .unwrap();
    }

    fn uninstall(&self) {
        remove_dir_all(&self.zpm_destination).unwrap()
    }

    fn update(&self) {
        fast_forward_merge(&self.zpm_destination, "origin", "main");
    }

    fn is_installed(&self) -> bool {
        which("zpm").is_some()
    }

    fn name(&self) -> String {
        String::from("zpm")
    }
}

impl Deref for Zpm {
    type Target = dyn Package;

    fn deref(&self) -> &Self::Target {
        self as &dyn Package
    }
}

#[derive(Clone)]
pub enum ZshDependencies {
    ZPM(Zpm),
    Starship(Starship),
}

pub struct Zsh {
    config: Option<PathBuf>,
    destination: Option<PathBuf>,
    dependencies: Vec<ZshDependencies>,
    selector: Selector,
}

impl Zsh {
    pub fn new(
        config: Option<&PathBuf>,
        destination: Option<&PathBuf>,
        dependencies: Vec<ZshDependencies>,
    ) -> Self {
        let selector = Selector::new(vec![SupportedPackageManager::APT]);
        Self {
            config: config.cloned(),
            destination: destination.cloned(),
            dependencies,
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

impl Package for Zsh {
    fn dependencies(&self) -> Vec<Box<dyn Package>> {
        self.dependencies
            .clone()
            .into_iter()
            .map(|dep| match dep {
                ZshDependencies::ZPM(zpm) => Box::new(zpm) as Box<dyn Package>,
                ZshDependencies::Starship(starship) => {
                    Box::new(starship) as Box<dyn Package>
                },
            })
            .collect()
    }

    fn name(&self) -> String {
        String::from("zsh")
    }

    fn is_installed(&self) -> bool {
        which("zsh").is_some()
    }

    fn install(&self) {
        self.selector.install("zsh").unwrap();
    }

    fn post_install(&self) {
        match (&self.config, &self.destination) {
            (Some(conf), Some(dst)) => {
                if !dst.exists() {
                    println!("Creating zsh folder at {}", conf.display());
                    create_dir(&dst).unwrap();
                }
                link_zsh_configurations(&conf, &dst);
            },
            _ => (),
        };

        Self::create_base_zshenv_file();
        let zsh_path = which("zsh").unwrap();
        chsh(zsh_path.as_str(), None);
    }

    fn update(&self) {
        self.selector.update("zsh").unwrap();
    }

    fn uninstall(&self) {
        self.selector.uninstall("zsh").unwrap();
    }
}

impl Deref for Zsh {
    type Target = dyn Package;

    fn deref(&self) -> &Self::Target {
        self as &dyn Package
    }
}

fn link_zsh_configurations(folder: &PathBuf, dst_prefix: &PathBuf) {
    let walker = WalkDir::new(&folder);
    for entry in walker.into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_dir() {
            continue;
        }
        let entry_relative_path = path.strip_prefix(&folder).unwrap();
        let destination = dst_prefix.join(entry_relative_path);
        println!("linking {} to {}", path.display(), &destination.display());
        let destination_path = PathBuf::from(&destination);
        if destination_path.exists() {
            remove_file(&destination).unwrap();
        }
        let entry_relative_path = path.parent();
        let destination_path_parent = destination_path.parent();
        if entry_relative_path.is_some_and(|p| p.is_dir())
            && destination_path_parent.is_some_and(|p| !p.exists())
        {
            println!(
                "folder {} does not exist, but it's required by {}. Creating it...",
                entry_relative_path.unwrap().display(),
                destination.display()
            );
            create_dir(destination_path_parent.unwrap()).unwrap();
        }
        symlink(path, destination).unwrap();
    }
}

