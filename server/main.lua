local Config = Config

local function getItemCount(source, item)
    return exports.ox_inventory:Search(source, 'count', item) or 0
end

local function canCarry(source, item, amount)
    return exports.ox_inventory:CanCarryItem(source, item, amount)
end

local function clampBatchCount(count)
    count = tonumber(count) or 1
    local maxBatch = Config.MaxBottlesPerBatch or 3
    if count < 1 then return 1 end
    if count > maxBatch then return maxBatch end
    return math.floor(count)
end

---@param source number
---@return boolean, string|nil
local function isJobAllowed(source)
    if not Config.Job.enabled then return true end

    local player = exports.qbx_core:GetPlayer(source)
    if not player then return false, 'wrong_job' end

    local job = player.PlayerData.job
    if not job then return false, 'wrong_job' end

    if Config.Job.requireDuty and not job.onduty then
        return false, 'not_on_duty'
    end

    local names = Config.Job.names
    if type(names) == 'string' then
        if job.name == names then return true end
        return false, 'wrong_job'
    end

    for i = 1, #names do
        if job.name == names[i] then
            return true
        end
    end

    return false, 'wrong_job'
end

---@param source number
---@return boolean, string|nil
local function assertJobAccess(source)
    local allowed, reason = isJobAllowed(source)
    if not allowed then
        return false, reason
    end

    return true
end

lib.callback.register('ubsnitrorecharge:server:getInventoryState', function(source)
    if not assertJobAccess(source) then
        return false
    end

    return {
        empty = getItemCount(source, Config.Items.empty),
        full = getItemCount(source, Config.Items.full),
    }
end)

lib.callback.register('ubsnitrorecharge:server:startProcess', function(source, processType, count)
    if not assertJobAccess(source) then
        return false, 'wrong_job'
    end

    if processType ~= 'refill' and processType ~= 'empty' then
        return false, 'invalid_process'
    end

    count = clampBatchCount(count)
    local removeItem = processType == 'refill' and Config.Items.empty or Config.Items.full

    if getItemCount(source, removeItem) < count then
        return false, 'missing_item'
    end

    if not exports.ox_inventory:RemoveItem(source, removeItem, count) then
        return false, 'missing_item'
    end

    return true, count
end)

lib.callback.register('ubsnitrorecharge:server:cancelProcess', function(source, processType, count)
    if not assertJobAccess(source) then
        return false, 'wrong_job'
    end

    count = clampBatchCount(count)
    local returnItem

    if processType == 'refill' or processType == 'vent' then
        returnItem = Config.Items.empty
    elseif processType == 'empty' then
        returnItem = Config.Items.full
    else
        return false
    end

    if not canCarry(source, returnItem, count) then
        return false, 'inventory_full'
    end

    return exports.ox_inventory:AddItem(source, returnItem, count)
end)

lib.callback.register('ubsnitrorecharge:server:completeProcess', function(source, outcome, count)
    if not assertJobAccess(source) then
        return false, 'wrong_job'
    end

    count = clampBatchCount(count)
    local addItem

    if outcome == 'refill' then
        addItem = Config.Items.full
    elseif outcome == 'empty' or outcome == 'vent' then
        addItem = Config.Items.empty
    else
        return false, 'invalid_process'
    end

    if not canCarry(source, addItem, count) then
        return false, 'inventory_full'
    end

    if not exports.ox_inventory:AddItem(source, addItem, count) then
        return false, 'inventory_full'
    end

    return true
end)

lib.callback.register('ubsnitrorecharge:server:hasItem', function(source, itemName)
    if not assertJobAccess(source) then
        return false
    end

    return getItemCount(source, itemName) > 0
end)
