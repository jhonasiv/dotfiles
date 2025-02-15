use std::{
    env,
    fs::{create_dir, remove_dir_all},
    io::stdin,
    path::PathBuf,
    process::Command,
};

use dotset::{
    absolute_path, default_clone, link_all_files_and_directories_from_folder, which,
    CloneOptions, DisplayablePackage, Package,
};
use git2::{build::CheckoutBuilder, Repository};

pub struct Neovim {
    repo_destination: PathBuf,
    build_destination: Option<PathBuf>,
    config_folder: Option<PathBuf>,
    config_destination: Option<PathBuf>,
    version_tag: String,
}

impl Neovim {
    pub fn new(
        repo_destination: PathBuf,
        build_destination: Option<PathBuf>,
        config_folder: Option<PathBuf>,
        config_destination: Option<PathBuf>,
        version_tag: Option<String>,
    ) -> Self {
        let repo_dst = absolute_path(&repo_destination);
        let build_dst = build_destination.map(|b| absolute_path(&b));
        let config_f = config_folder.map(|c| absolute_path(&c));
        let config_dst = config_destination.map(|c| absolute_path(&c));
        Self {
            repo_destination: repo_dst,
            build_destination: build_dst,
            config_folder: config_f,
            config_destination: config_dst,
            version_tag: version_tag.map_or(String::from("stable"), |t| t),
        }
    }
}

impl DisplayablePackage for Neovim {
    fn display(&self) -> String {
        String::from("Neovim")
    }

    fn debug(&self) -> String {
        format!("Neovim {{ repo: {:#?}, build: {:#?}, config_ref: {:#?}, config_dst: {:#?}, version_tag: {:#?} }}", self.repo_destination.display(), self.build_destination, self.config_folder, self.config_destination, self.version_tag)
    }
}

impl Package for Neovim {
    fn name(&self) -> String {
        String::from("neovim")
    }

    fn is_installed(&self) -> bool {
        which("nvim").is_some()
            && self.repo_destination.exists()
            && self
                .build_destination
                .as_ref()
                .is_some_and(|b| b.join("nvim").exists())
    }

    fn install(&self, interactive: bool) {
        let repo = if self.repo_destination.exists() {
            Repository::open(self.repo_destination.to_owned()).unwrap()
        } else {
            default_clone(
                "https://github.com/neovim/neovim",
                self.repo_destination.to_owned(),
                CloneOptions::default(),
            )
            .expect("failed cloning neovim repository")
        };

        let tags = repo.tag_names(None).unwrap();
        let tag_name = if interactive {
            println!("These are the available tags for neovim:");
            for (i, tag) in tags.into_iter().enumerate() {
                println!("{}. {}", i, tag.unwrap());
            }
            println!("What's the index of the one you would like to install? ");
            let mut input = String::new();
            stdin().read_line(&mut input).unwrap();
            let trimmed = input.trim();
            let index: usize = trimmed.parse().unwrap();

            tags.into_iter().nth(index).map(|t| t.unwrap()).unwrap()
        } else {
            self.version_tag.as_str()
        };

        let tag = repo
            .revparse_single(format!("refs/tags/{}", tag_name).as_str())
            .unwrap();
        repo.checkout_tree(&tag, Some(CheckoutBuilder::new().force()))
            .unwrap();

        let cwd = env::current_dir().unwrap();
        env::set_current_dir(&self.repo_destination).unwrap();

        let mut make_args = vec!["CMAKE_BUILD_TYPE=Release"];
        let arg: String;
        if let Some(build) = &self.build_destination {
            let build_path_str = build.as_os_str().to_str().unwrap();
            arg = format!(
                "CMAKE_EXTRA_ARGS=\"-DCMAKE_INSTALL_PREFIX={}\"",
                build_path_str
            );
            make_args.push(&arg);
        }

        Command::new("make").args(make_args).output().unwrap();
        Command::new("make").arg("install").output().unwrap();

        env::set_current_dir(cwd).unwrap();
    }

    fn post_install(&self, _interactive: bool) {
        match (&self.config_folder, &self.config_destination) {
            (Some(origin), Some(dst)) => {
                if !dst.exists() {
                    println!("Creating neovim configuration folder at {}", dst.display());
                    create_dir(&dst).unwrap();
                }
                link_all_files_and_directories_from_folder(&origin, &dst);
            },
            _ => (),
        }
    }

    fn uninstall(&self, _interactive: bool) {
        let cwd = env::current_dir().unwrap();
        if self.repo_destination.exists() {
            env::set_current_dir(&self.repo_destination).unwrap();
            Command::new("cmake")
                .arg("--build")
                .arg("build/")
                .arg("--target")
                .arg("uninstall")
                .output()
                .unwrap();
        }
        if self.build_destination.as_ref().is_some_and(|b| b.exists()) {
            let build = self.build_destination.as_ref().unwrap();
            remove_dir_all(build).unwrap();
        }
        env::set_current_dir(cwd).unwrap();
    }
}
