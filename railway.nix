{ pkgs }: {
  deps = [
    pkgs.cacert
    pkgs.nodejs-18_x
    pkgs.nss
    pkgs.gtk3
    pkgs.xorg.libX11
    pkgs.xorg.libXcomposite
    pkgs.xorg.libXcursor
    pkgs.xorg.libXdamage
    pkgs.xorg.libXext
    pkgs.xorg.libXi
    pkgs.xorg.libXrandr
    pkgs.xorg.libXrender
    pkgs.xorg.libXfixes
    pkgs.xorg.libXss
    pkgs.xorg.libXtst
    pkgs.libxkbcommon
    pkgs.atk
    pkgs.pango
    pkgs.cairo
    pkgs.glib
    pkgs.freetype
    pkgs.fontconfig
    pkgs.dbus
    pkgs.libusb1
  ];
}