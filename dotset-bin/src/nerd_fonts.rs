use std::{
    fmt::{Debug, Display},
    fs::remove_dir_all,
    path::PathBuf,
};

use dotset::{
    fc_cache, fc_list, xdg_data_dir, Curl, DisplayablePackage, DownloadOptions, Package,
    Tar,
};

#[derive(Clone)]
pub enum NerdFonts {
    JetBrainsMono,
    FiraCode,
}

impl NerdFonts {
    pub fn font_name(&self) -> &str {
        match self {
            Self::FiraCode => "FiraCode",
            Self::JetBrainsMono => "JetBrainsMono",
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
            Self::JetBrainsMono => "JetBrainsMono NL Nerd Font",
        }
    }
}

impl DisplayablePackage for NerdFonts {
    fn display(&self) -> String {
        format!("NerdFont {}", self.font_name())
    }

    fn debug(&self) -> String {
        format!("NerdFont {}", self.font_name())
    }
}

impl Package for NerdFonts {
    fn update(&self) {
        self.install(false);
    }

    fn install(&self, _interactive: bool) {
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

    fn uninstall(&self, _interactive: bool) {
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
