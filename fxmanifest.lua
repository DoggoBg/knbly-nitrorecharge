fx_version 'cerulean'
game 'gta5'

author 'Iv4o0o Nitrous Station'
description 'Nitrous bottle refill station'
version '1.0.0'

ox_lib 'locale'

shared_scripts {
    '@ox_lib/init.lua',
    '@qbx_core/modules/lib.lua',
    'config.lua',
}

client_scripts {
    '@qbx_core/modules/playerdata.lua',
    'client/main.lua',
}

server_scripts {
    'server/main.lua',
}

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/style.css',
    'html/nos-cap.css',
    'html/app.js',
    'html/minigame.css',
    'html/minigame.js',
    'html/empty-minigame.css',
    'html/empty-minigame.js',
    'minigame/minigame.css',
    'minigame/minigame.js',
    'minigame/nos-cap.css',
    'minigame/empty-minigame.css',
    'minigame/empty-minigame.js',
    'locales/*.json',
}

lua54 'yes'
use_experimental_fxv2_oal 'yes'

dependencies {
    'qbx_core',
    'ox_lib',
    'ox_target',
    'ox_inventory',
}
