local Config = Config

local activeStation
local isBusy = false
local pendingProcess
local pendingBottleCount = 1
local uiOpen = false
local minigameOpen = false
local minigameWaiting = false
local minigameSuccess = false
local minigameReady = false
local processCancelled = false

local function notify(key, nType)
    exports.qbx_core:Notify(locale(key), nType or 'error')
end

---@return boolean
local function isJobAllowed()
    if not Config.Job.enabled then return true end

    local job = QBX.PlayerData.job
    if not job then return false end

    if Config.Job.requireDuty and not job.onduty then return false end

    local names = Config.Job.names
    if type(names) == 'string' then
        return job.name == names
    end

    for i = 1, #names do
        if job.name == names[i] then
            return true
        end
    end

    return false
end

local function notifyJobDenied()
    if Config.Job.enabled and QBX.PlayerData.job and Config.Job.requireDuty and not QBX.PlayerData.job.onduty then
        notify('not_on_duty')
        return
    end

    notify('wrong_job')
end

local function loadAnimDict(dict)
    lib.requestAnimDict(dict)
end

local function stopEmote()
    if Config.Emotes.useScully and GetResourceState('scully_emotemenu') == 'started' then
        exports.scully_emotemenu:cancelEmote()
        return
    end

    ClearPedTasks(cache.ped)
end

local function playEmote(command)
    if Config.Emotes.useScully and GetResourceState('scully_emotemenu') == 'started' then
        exports.scully_emotemenu:playEmoteByCommand(command)
        return
    end

    local anim = Config.Emotes.fallback[command]
    if not anim then return end

    loadAnimDict(anim.dict)
    TaskPlayAnim(
        cache.ped,
        anim.dict,
        anim.clip,
        8.0, -8.0, -1,
        anim.flag,
        0.0, false, false, false
    )
end

local function setUiFocus(state)
    SetNuiFocus(state, state)
end

local function setStationUi(state, data)
    uiOpen = state
    setUiFocus(state or minigameOpen)
    SendNUIMessage({
        action = state and 'open' or 'close',
        data = data or {},
    })
end

local function showCancelHint()
    SendNUIMessage({ action = 'showCancelHint' })
end

local function hideCancelHint()
    SendNUIMessage({ action = 'hideCancelHint' })
end

local function cancelActiveProcess()
    if not isBusy then return end
    processCancelled = true
    minigameWaiting = false
    minigameSuccess = false
end

local function waitWithCancel(ms)
    local endTime = GetGameTimer() + ms
    while GetGameTimer() < endTime do
        if processCancelled then return false end
        Wait(50)
    end
    return true
end

local function getEmptyMinigameConfig()
    local cfg = Config.EmptyMinigame or {}
    return {
        ventDuration = cfg.ventDuration or 8000,
        valveOpenAmount = cfg.valveOpenAmount or 1400,
        valveOpenSensitivity = cfg.valveOpenSensitivity or 0.55,
        loadTimeout = cfg.loadTimeout or 5000,
    }
end

local function openMinigameUi(mode, bottleCount)
    minigameOpen = true
    setUiFocus(true)
    bottleCount = bottleCount or pendingBottleCount or 1

    if mode == 'empty' then
        SendNUIMessage({ action = 'closeMinigame' })
        Wait(50)

        local emptyCfg = getEmptyMinigameConfig()
        SendNUIMessage({
            action = 'openEmptyMinigame',
            data = {
                ventDuration = emptyCfg.ventDuration,
                valveOpenAmount = emptyCfg.valveOpenAmount,
                valveOpenSensitivity = emptyCfg.valveOpenSensitivity,
                bottleCount = bottleCount,
            },
        })
        return
    end

    SendNUIMessage({ action = 'closeEmptyMinigame' })

    local refillCfg = Config.RefillMinigame or {}
    SendNUIMessage({
        action = 'openMinigame',
        data = {
            fillDuration = refillCfg.fillDuration or 7000,
            valveCloseAmount = refillCfg.valveCloseAmount or 1600,
            valveCloseSensitivity = refillCfg.valveCloseSensitivity or 0.55,
            bottleCount = bottleCount,
        },
    })
end

local function closeMinigameUi()
    minigameOpen = false
    SendNUIMessage({ action = 'closeMinigame' })
    SendNUIMessage({ action = 'closeEmptyMinigame' })
    if not uiOpen then
        setUiFocus(false)
    end
end

local function getInventoryState()
    return lib.callback.await('ubsnitrorecharge:server:getInventoryState', false)
end

local function openStationUi(station, mode, resultData)
    activeStation = station
    local inv = getInventoryState()

    if not inv then
        notifyJobDenied()
        closeStationUi()
        return
    end

    setStationUi(true, {
        mode = mode or 'menu',
        bottleState = resultData and resultData.bottleState or nil,
        pendingProcess = pendingProcess,
        bottleCount = resultData and resultData.bottleCount or pendingBottleCount,
        hasEmpty = inv.empty,
        hasFull = inv.full,
        maxBatch = Config.MaxBottlesPerBatch or 3,
    })
end

local function closeStationUi()
    setStationUi(false)
    if not minigameOpen and not isBusy then
        activeStation = nil
    end
end

local function runRefillMinigame(bottleCount)
    minigameWaiting = true
    minigameSuccess = false
    minigameReady = false
    openMinigameUi('refill', bottleCount)

    local loadTimeout = GetGameTimer() + (Config.RefillMinigame.loadTimeout or 5000)
    while not minigameReady and GetGameTimer() < loadTimeout do
        if processCancelled then
            minigameWaiting = false
            closeMinigameUi()
            return false
        end
        Wait(50)
    end

    if not minigameReady then
        if Config.Debug then
            print('[ubsnitrorecharge] Refill minigame UI failed to load')
        end
        minigameWaiting = false
        closeMinigameUi()
        return false
    end

    while minigameWaiting do
        if processCancelled then
            closeMinigameUi()
            return false
        end
        Wait(50)
    end

    closeMinigameUi()
    return minigameSuccess
end

local function runEmptyMinigame(bottleCount)
    minigameWaiting = true
    minigameSuccess = false
    minigameReady = false
    openMinigameUi('empty', bottleCount)

    local emptyCfg = getEmptyMinigameConfig()
    local loadTimeout = GetGameTimer() + emptyCfg.loadTimeout
    while not minigameReady and GetGameTimer() < loadTimeout do
        if processCancelled then
            minigameWaiting = false
            closeMinigameUi()
            return false
        end
        Wait(50)
    end

    if not minigameReady then
        print('[ubsnitrorecharge] Empty minigame UI failed to load. Restart the resource: ensure ubsnitrorecharge')
        minigameWaiting = false
        closeMinigameUi()
        return false
    end

    while minigameWaiting do
        if processCancelled then
            closeMinigameUi()
            return false
        end
        Wait(50)
    end

    closeMinigameUi()
    return minigameSuccess
end

local function abortProcess(station, restoreProcess)
    stopEmote()
    closeMinigameUi()
    hideCancelHint()
    FreezeEntityPosition(cache.ped, false)
    isBusy = false
    minigameWaiting = false
    minigameReady = false
    processCancelled = false

    local restored = lib.callback.await('ubsnitrorecharge:server:cancelProcess', false, restoreProcess, pendingBottleCount)
    if not restored then
        notify('inventory_full')
    end

    pendingProcess = nil
    pendingBottleCount = 1
    openStationUi(station, 'menu')
end

local function runBottleProcess(station, processType, options)
    options = options or {}
    local skipItemTake = options.skipItemTake
    local resultProcess = options.resultProcess or processType
    local bottleCount = options.count or 1
    local isRefill = resultProcess == 'refill'

    if isBusy then
        notify('process_busy')
        return false
    end

    if not skipItemTake then
        local started, reason = lib.callback.await('ubsnitrorecharge:server:startProcess', false, processType, bottleCount)
        if not started then
            if reason == 'missing_item' then
                notify(processType == 'refill' and 'no_empty_bottle' or 'no_full_bottle')
            else
                notify('missing_item')
            end
            return false
        end
    end

    isBusy = true
    pendingProcess = resultProcess
    pendingBottleCount = bottleCount
    processCancelled = false
    closeStationUi()
    showCancelHint()

    local ped = cache.ped
    FreezeEntityPosition(ped, true)

    local processPassed = false

    if isRefill then
        playEmote(Config.Emotes.box)
        if not waitWithCancel(Config.Emotes.boxDuration) then
            stopEmote()
            abortProcess(station, resultProcess)
            notify('process_cancelled', 'inform')
            return false
        end
        stopEmote()
        if not waitWithCancel(250) then
            abortProcess(station, resultProcess)
            notify('process_cancelled', 'inform')
            return false
        end
        processPassed = runRefillMinigame(bottleCount)
    else
        processPassed = runEmptyMinigame(bottleCount)
    end

    stopEmote()

    if processCancelled then
        abortProcess(station, resultProcess)
        notify('process_cancelled', 'inform')
        return false
    end

    if not processPassed then
        notify(isRefill and 'minigame_failed_refill' or 'minigame_failed_empty')
        abortProcess(station, resultProcess)
        return false
    end

    hideCancelHint()
    FreezeEntityPosition(ped, false)
    isBusy = false

    openStationUi(station, 'result', {
        bottleState = resultProcess == 'refill' and 'full' or 'empty',
        bottleCount = bottleCount,
    })

    return true
end

RegisterNUICallback('minigameReady', function(_, cb)
    cb('ok')
    minigameReady = true
end)

RegisterNUICallback('minigamePhase', function(data, cb)
    cb('ok')
    if data.phase == 'fill' or data.phase == 'vent' then
        playEmote(Config.Emotes.mechanic)
    end
end)

RegisterNUICallback('minigameComplete', function(_, cb)
    cb('ok')
    minigameSuccess = true
    minigameWaiting = false
end)

RegisterNUICallback('cancelProcess', function(_, cb)
    cb('ok')
    cancelActiveProcess()
end)

RegisterNUICallback('close', function(_, cb)
    cb('ok')
    if isBusy or minigameOpen then return end

    if pendingProcess then
        local restored = lib.callback.await('ubsnitrorecharge:server:cancelProcess', false, pendingProcess, pendingBottleCount)
        if not restored then
            notify('inventory_full')
        end
        pendingProcess = nil
        pendingBottleCount = 1
    end

    closeStationUi()
    activeStation = nil
end)

RegisterNUICallback('startRefill', function(data, cb)
    cb('ok')
    if not activeStation or isBusy then return end
    local count = tonumber(data and data.count) or 1
    runBottleProcess(activeStation, 'refill', { count = count })
end)

RegisterNUICallback('startEmpty', function(data, cb)
    cb('ok')
    if not activeStation or isBusy then return end
    local count = tonumber(data and data.count) or 1
    runBottleProcess(activeStation, 'empty', { count = count })
end)

RegisterNUICallback('done', function(_, cb)
    cb('ok')
    if not pendingProcess or isBusy then return end

    local outcome = pendingProcess
    local success, reason = lib.callback.await('ubsnitrorecharge:server:completeProcess', false, outcome, pendingBottleCount)

    if not success then
        if reason == 'inventory_full' then
            notify('inventory_full')
        else
            notify('missing_item')
        end
        return
    end

    if pendingBottleCount > 1 then
        local msgKey = outcome == 'refill' and 'refill_done_batch' or 'empty_done_batch'
        notify(string.format(locale(msgKey), pendingBottleCount), 'success')
    else
        notify(outcome == 'refill' and 'refill_done' or 'empty_done', 'success')
    end
    pendingProcess = nil
    pendingBottleCount = 1
    closeStationUi()
    activeStation = nil
end)

local function createStationBlip(station)
    if not Config.Blips.enabled then return end

    local blip = AddBlipForCoord(station.coords.x, station.coords.y, station.coords.z)
    SetBlipSprite(blip, Config.Blips.sprite)
    SetBlipDisplay(blip, 4)
    SetBlipScale(blip, Config.Blips.scale)
    SetBlipColour(blip, Config.Blips.colour)
    SetBlipAsShortRange(blip, true)
    BeginTextCommandSetBlipName('STRING')
    AddTextComponentSubstringPlayerName(Config.Blips.label)
    EndTextCommandSetBlipName(blip)
end

CreateThread(function()
    while true do
        if isBusy then
            Wait(0)
            if IsControlJustPressed(0, 73) then
                cancelActiveProcess()
            end
        else
            Wait(400)
        end
    end
end)

CreateThread(function()
    for i = 1, #Config.Stations do
        local station = Config.Stations[i]
        createStationBlip(station)

        exports.ox_target:addSphereZone({
            coords = station.coords,
            radius = station.targetRadius,
            debug = Config.Debug,
            options = {
                {
                    name = ('ubsnitrorecharge:%s'):format(i),
                    label = locale('target_label'),
                    icon = Config.Target.icon,
                    distance = Config.Target.distance,
                    canInteract = function()
                        return isJobAllowed()
                    end,
                    onSelect = function()
                        if not isJobAllowed() then
                            notifyJobDenied()
                            return
                        end
                        if isBusy then
                            notify('process_busy')
                            return
                        end
                        openStationUi(station, 'menu')
                    end,
                },
            },
        })
    end
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then return end
    stopEmote()
    minigameWaiting = false
    minigameReady = false
    processCancelled = false
    hideCancelHint()
    if uiOpen or minigameOpen then
        SetNuiFocus(false, false)
    end
end)
