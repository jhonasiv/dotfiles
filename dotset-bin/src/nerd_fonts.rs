use std::{path::PathBuf, fs::remove_dir_all, ops::Deref};

use dotset::{Curl, DownloadOptions, Package, xdg_data_dir, Tar, fc_cache, fc_list};

#[derive(Clone)]
pub enum NerdFonts {
    JetBrainsMono,
    FiraCode,
}

impl NerdFonts {
    pub fn font_name(&self) -> &str {
        match self {
            Self::FiraCode => "FiraCode",
            Self::JetBrainsMono => "JetBrainsMono"
        }
    }
    
    pub fn url(&self) -> &str {
         match self {
            Self::FiraCode => "https://github.com/ryanoasis/nerd-fonts/releases/latest/download/FiraMono.tar.xz",
            Self::JetBrainsMono => 
                "https://github.com/ryanoasis/nerd-fonts/releases/latest/download/JetBrainsMono.tar.xz"
        }
    }
    
    pub fn family_name(&self) -> &str {
        match self {
            Self::FiraCode => "FiraMono Nerd Font",
            Self::JetBrainsMono => "JetBrainsMono NL Nerd Font"
        }
    }
}

impl Package for NerdFonts {
    fn update(&self) {
        self.install();
    }

    fn install(&self) {
        let options = Some(DownloadOptions {
            follow_redirects: true,
            fail_on_error: true,
        });
        let url = self.url();
        let font_name = self.font_name();
        let tar_xz_file = format!("/tmp/{}.tar.xz", font_name);
        Curl::download_and_save(url, &tar_xz_file, options);
        let destination = xdg_data_dir().join(format!("fonts/{}", font_name));
        Tar::unpack_tarxz(&PathBuf::from(tar_xz_file), &destination);
        fc_cache();
    }
    
    fn uninstall(&self) {
        let font_name = self.font_name();
        println!("Uninstalling Nerd Font {}", font_name);
        let font_folder = xdg_data_dir().join(format!("fonts/{}", font_name));
        remove_dir_all(font_folder).unwrap();
        fc_cache();
    }
    
    fn is_installed(&self) -> bool {
        let output = String::from_utf8(fc_list(self.family_name()).stdout).unwrap();
        !output.is_empty()
    }
    
    fn name(&self) -> String {
        match self {
            Self::FiraCode => String::from("FiraCode"),
            Self::JetBrainsMono => String::from("JetBrainsMono"),
        }
    }
}

impl Deref for NerdFonts {
    type Target = dyn Package;
    
    fn deref(&self) -> &Self::Target {
        self as &dyn Package
    }
}