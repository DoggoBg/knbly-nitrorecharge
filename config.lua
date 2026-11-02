Config = {}

Config.Debug = false


Config.Job = {
    enabled = true,
    names = 'mechanic',
    requireDuty = true,
}


Config.Items = {
    empty = 'empty_nitrous_bottle',
    full = 'nitrous_bottle',
}


Config.MaxBottlesPerBatch = 3


Config.Stations = {
    {
        coords = vec3(-351.17, -102.42, 38.01),
        heading = 160.36,
        targetRadius = 1.5,
        label = 'NOS Refill Bench',
    },
}

Config.Target = {
    icon = 'fas fa-wind',
    distance = 2.0,
}


Config.RefillMinigame = {
    fillDuration = 7000,
    loadTimeout = 5000,
    --- Higher = takes longer to close the bottle tap
    valveCloseAmount = 1600,
    valveCloseSensitivity = 0.55,
}


Config.EmptyMinigame = {
    loadTimeout = 5000,
    ventDuration = 8000,
    valveOpenAmount = 1400,
    valveOpenSensitivity = 0.55,
}


Config.Emotes = {
    useScully = true,
    box = 'box',
    mechanic = 'mechanic',
    boxDuration = 1500,
    fallback = {
        box = { dict = 'anim@heists@box_carry@', clip = 'idle', flag = 49 },
        mechanic = { dict = 'mini@repair', clip = 'fixing_a_ped', flag = 49 },
    },
}

Config.Blips = {
    enabled = false,
    sprite = 566,
    colour = 38,
    scale = 0.75,
    label = 'NOS Refill',
}
