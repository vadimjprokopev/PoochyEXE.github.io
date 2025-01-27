class Upgrade {
	constructor(id, name, category, description, cost_func, value_func, max_level, value_suffix, visible_func, on_update, on_buy) {
		this.id = id;
		this.name = name;
		this.category = category;
		this.description = description;
		this.cost_func = cost_func;
		if (value_func) {
			this.value_func = value_func;
		} else {
			this.value_func = this.GetLevel;
		}
		this.cost = cost_func(0);
		this.max_level = max_level;
		this.value_suffix = value_suffix;
		const kNoop = function() {};
		if (visible_func) {
			this.visible_func = visible_func;
		} else {
			this.visible_func = function() { return true; }
		}
		if (on_update) {
			this.on_update = on_update;
		} else {
			this.on_update = kNoop;
		}
		if (on_buy) {
			this.on_buy = on_buy;
		} else {
			this.on_buy = kNoop;
		}
	}
	
	ShouldEnableButton() {
		if (this.GetLevel() >= this.max_level) {
			return false;
		}
		if (this.GetCost() > state.save_file.points) {
			return false;
		}
		return true;
	}
	
	Update() {
		this.on_update();
		state.update_upgrade_buttons = true;
	}
	
	Buy() {
		let cost = this.GetCost();
		if (state.save_file.points < cost) {
			return false;
		}
		++state.save_file.upgrade_levels[this.id];
		state.save_file.points -= cost;
		this.Update();
		this.on_buy();
		return true;
	}
	
	OnClick() {
		this.Buy();
	}
	
	GetLevel() {
		return state.save_file.upgrade_levels[this.id];
	}
	
	GetCost() {
		return this.cost_func(this.GetLevel());
	}
	
	GetValue() {
		return this.value_func(this.GetLevel());
	}
	
	GetText() {
		let result = "<b>" + this.name + "</b>";
		let level = this.GetLevel();
		result += "<br/>" + FormatNumberShort(this.value_func(level)) + this.value_suffix;
		if (level >= this.max_level) {
			result += " (MAX)";
		} else {
			result += " \u2192 " + FormatNumberShort(this.value_func(level + 1)) + this.value_suffix;
			result += "<br/>Cost: " + FormatNumberShort(this.cost_func(level));
		}
		result += "<br/>Bought: " + level;
		return result;
	}
}

class DelayReductionUpgrade extends Upgrade {
	constructor(id, name, category, description, cost_func, value_func, max_level, item_suffix, visible_func, on_update, on_buy) {
		super(id, name, category, description, cost_func, value_func, max_level, /*value_suffix=*/" ms", visible_func, on_update, on_buy);
		this.item_suffix = item_suffix;
	}
	
	GetText() {
		let result = "<b>" + this.name + "</b>";
		let level = this.GetLevel();
		let delay_now = this.value_func(level);
		let rate_now = 60000.0 / delay_now;
		if (level >= this.max_level) {
			result += "<br/>" + FormatNumberShort(delay_now) + this.value_suffix;
			result += "<br/>(" + FormatNumberShort(rate_now) + " " + this.item_suffix + "/min) (MAX)";
		} else {
			let delay_next = this.value_func(level + 1);
			let rate_next = 60000.0 / delay_next;
			result += "<br/>" + FormatNumberShort(delay_now) + this.value_suffix;
			result += " \u2192 " + FormatNumberShort(delay_next) + this.value_suffix;
			result += "<br/>(" + FormatNumberShort(rate_now);
			result += " \u2192 " + FormatNumberShort(rate_next);
			result += " " + this.item_suffix + "/min)";
			result += "<br/>Cost: " + FormatNumberShort(this.cost_func(level));
		}
		result += "<br/>Bought: " + level;
		return result;
	}
}

class FeatureUnlockUpgrade extends Upgrade {
	constructor(id, name, category, description, cost_func, visible_func, on_update, on_buy) {
		super(id, name, category, description, cost_func, /*value_func=*/null, /*max_level=*/1,
				/*value_suffix=*/'', visible_func, on_update, on_buy);
	}
	
	GetText() {
		let result = "<b>" + this.name + "</b><br/>";
		if (this.GetLevel() == 0) {
			result += "Cost: " + FormatNumberShort(this.cost_func());
		} else {
			result += "Unlocked!"
		}
		return result;
	}
}

class FixedCostFeatureUnlockUpgrade extends FeatureUnlockUpgrade {
	constructor(id, name, category, description, cost, visible_func, on_update, on_buy) {
		super(id, name, category, description, function(level) { return cost; }, visible_func, on_update, on_buy);
	}
}

class ToggleUnlockUpgrade extends FixedCostFeatureUnlockUpgrade {
	constructor(id, name, category, description, cost, visible_func, on_update, on_buy) {
		super(id, name, category, description, cost, visible_func, on_update, on_buy);
	}
	
	SaveFileKey() {
		return this.id + "_enabled";
	}
	
	GetToggleState() {
		return state.save_file[this.SaveFileKey()];
	}
	
	SetToggleState(new_state) {
		state.save_file[this.SaveFileKey()] = new_state;
	}
	
	OnClick() {
		if (this.GetLevel() == 0) {
			if (this.Buy()) {
				this.SetToggleState(true);
			}
		} else {
			this.SetToggleState(!this.GetToggleState());
		}
		this.Update();
	}
	
	GetText() {
		let result = "<b>" + this.name + "</b><br/>";
		if (this.GetLevel() == 0) {
			result += "Cost: " + FormatNumberShort(this.cost);
		} else if (this.GetToggleState()) {
			result += "ON";
		} else {
			result += "OFF";
		}
		return result;
	}
	
	ShouldEnableButton() {
		if (this.GetLevel() > 0) {
			return true;
		} else {
			return super.ShouldEnableButton();
		}
	}
}

class BallTypeUnlockUpgrade extends FeatureUnlockUpgrade {
	constructor(ball_type, ball_description, cost_func, visible_func) {
		super(/*id=*/"unlock_" + ball_type.name + "_balls",
				/*name=*/"Unlock " + ball_type.display_name + " Balls",
				/*category=*/ball_type.name + "_balls",
				/*description=*/"Unlock " + ball_type.name + " balls. " + ball_description,
				/*cost_func=*/cost_func,
				/*visible_func=*/visible_func);
	}
}

class BallTypeRateUpgrade extends Upgrade {
	constructor(ball_type, cost_func, value_func, max_level) {
		super(/*id=*/ball_type.name + "_ball_rate",
				/*name=*/ball_type.display_name + " Ball Rate",
				/*category=*/ball_type.name + "_balls",
				/*description=*/"Increases the probability of a ball being " + ball_type.name + ".",
				/*cost_func=*/cost_func,
				/*value_func=*/value_func,
				/*max_level=*/max_level,
				/*value_suffix=*/"%",
				/*visible_func=*/function() {
					return IsUnlocked("unlock_" + ball_type.name + "_balls");
				},
				/*on_update=*/function() {
					state.ball_type_rates[ball_type.id] = this.GetValue() / 100.0;
				},
				/*on_buy=*/null);
	}
}

function ActivateOrExtendDoubleScoreBuff() {
	state.save_file.score_buff_multiplier = 2.0;
	state.save_file.score_buff_duration = 60000.0;
}

function OnCenterSlotHit(ball) {
	if (ball.ball_type_index == kBallTypeIDs.RUBY ||
			ball.ball_type_index == kBallTypeIDs.TOPAZ ||
			ball.ball_type_index == kBallTypeIDs.AMETHYST ||
			ball.ball_type_index == kBallTypeIDs.OPAL) {
		let text_pos = new Point(ball.pos.x, ball.pos.y - 10);
		MaybeAddScoreText(/*level=*/2, "2\u00D7 scoring!", text_pos, "255,0,0");
		ActivateOrExtendDoubleScoreBuff();
	}
}

function ShouldDisplayGemstoneBallUpgrades() {
	return GetUpgradeLevel("gold_ball_rate") >= 19;
}

function GemstoneBallUnlockCost() {
	let prev_unlocks = 0;
	if (state) {
		if (IsUnlocked("unlock_ruby_balls")) {
			++prev_unlocks;
		}
		if (IsUnlocked("unlock_sapphire_balls")) {
			++prev_unlocks;
		}
		if (IsUnlocked("unlock_emerald_balls")) {
			++prev_unlocks;
		}
		if (IsUnlocked("unlock_topaz_balls")) {
			++prev_unlocks;
		}
		if (IsUnlocked("unlock_turquoise_balls")) {
			++prev_unlocks;
		}
		if (IsUnlocked("unlock_amethyst_balls")) {
			++prev_unlocks;
		}
	}
	return 1e12 * Math.pow(2000, prev_unlocks);
}

function Tier1GemstoneBallRateCostFunc(level) {
	return 5e12 * Math.pow(5, level);
}

function Tier2GemstoneBallRateCostFunc(level) {
	return 5e18 * Math.pow(5, level);
}

function GemstoneBallRateValueFunc(level) {
	return (level + 1) / 10.0;
}

function AllTier1GemstoneBallsUnlocked() {
	if (!state) return undefined;
	return IsUnlocked("unlock_ruby_balls") && IsUnlocked("unlock_sapphire_balls") && IsUnlocked("unlock_emerald_balls");
}

function AnyTier1GemstoneBallsUnlocked() {
	if (!state) return undefined;
	return IsUnlocked("unlock_ruby_balls") || IsUnlocked("unlock_sapphire_balls") || IsUnlocked("unlock_emerald_balls");
}

function AllTier2GemstoneBallsUnlocked() {
	if (!state) return undefined;
	return IsUnlocked("unlock_topaz_balls") && IsUnlocked("unlock_turquoise_balls") && IsUnlocked("unlock_amethyst_balls");
}

function AnyTier2GemstoneBallsUnlocked() {
	if (!state) return undefined;
	return IsUnlocked("unlock_topaz_balls") || IsUnlocked("unlock_turquoise_balls") || IsUnlocked("unlock_amethyst_balls");
}

function InitUpgrades() {
	const kTimesSymbol = "\u00D7";
	let upgrades_list = new Array();
	upgrades_list.push(new Upgrade("multiplier", "Point Multiplier",
			/*category=*/"board",
			/*description=*/"Multipiles all point gains.",
			/*cost_func=*/function(level) {
				return 200 * Math.pow(200, level);
			},
			/*value_func=*/function(level) {
				return Math.pow(5, level);
			},
			/*max_level=*/Infinity,
			/*value_suffix=*/kTimesSymbol,
			/*visible_func=*/null,
			/*on_update=*/UpdateBottomTargets,
			/*on_buy=*/function() {
				let bottom_targets = state.target_sets[0].targets;
				let popup_text = kTimesSymbol + "5";
				for (let i = 0; i < bottom_targets.length; ++i) {
					MaybeAddScoreText(/*level=*/2, popup_text, bottom_targets[i].pos, "0,0,255");
				}
				state.bonus_wheel.UpdateAllSpaces();
			}));
	upgrades_list.push(new Upgrade("center_value", "Center Slot Value",
			/*category=*/"board",
			/*description=*/"Point value of the bottom center slot.",
			/*cost_func=*/function(level) {
				return 100 * Math.pow(5, level);
			},
			/*value_func=*/function(level) {
				return 250 * Math.pow(2, level);
			},
			/*max_level=*/Infinity,
			/*value_suffix=*/'',
			/*visible_func=*/null,
			/*on_update=*/UpdateBottomTargets,
			/*on_buy=*/function() {
				let target = state.target_sets[0].targets[4];
				let popup_text = kTimesSymbol + "2";
				MaybeAddScoreText(/*level=*/2, popup_text, target.pos, "0,0,255");
				state.bonus_wheel.UpdateAllSpaces();
			}));
	upgrades_list.push(new ToggleUnlockUpgrade("auto_drop", "Auto-Drop",
			/*category=*/"auto-drop",
			/*description=*/"Automatically drops a ball when allowed. Click in the drop zone to move the drop position.",
			/*cost=*/100000,
			/*visible_func=*/function() {
				return GetUpgradeLevel("center_value") > 1;
			},
			/*on_update=*/function() {
				state.redraw_auto_drop = true;
				state.update_upgrade_buttons = true;
			}));
	upgrades_list.push(new DelayReductionUpgrade("auto_drop_delay", "Auto-Drop Delay",
			/*category=*/"auto-drop",
			/*description=*/"Decreases the auto drop delay.",
			/*cost_func=*/function(level) {
				return 200000 * Math.pow(2, level);
			},
			/*value_func=*/function(level) {
				return Math.max(100, Math.floor(Math.pow(0.9, level) * 1000.0));
			},
			/*max_level=*/22,
			/*item_suffix=*/"balls",
			/*visible_func=*/function() {
				return IsUnlocked("auto_drop");
			},
			/*on_update=*/function() {
				state.auto_drop_cooldown = this.GetValue();
				if (state.auto_drop_cooldown_left > state.auto_drop_cooldown) {
					state.auto_drop_cooldown_left = state.auto_drop_cooldown;
				}
				state.redraw_auto_drop = true;
			},
			/*on_buy=*/null));
	upgrades_list.push(new Upgrade("max_balls", "Max Balls",
			/*category=*/"board",
			/*description=*/"Maximum number of balls allowed on the board at once.",
			/*cost_func=*/function(level) {
				return 200000 * Math.pow(2, level);
			},
			/*value_func=*/function(level) {
				return level + 1;
			},
			/*max_level=*/49,
			/*value_suffix=*/'',
			/*visible_func=*/function() {
				return GetUpgradeLevel("center_value") > 1;
			},
			/*on_update=*/function() {
				return state.max_balls = this.GetValue();
			},
			/*on_buy=*/null));
	upgrades_list.push(new BallTypeUnlockUpgrade(
			/*ball_type=*/kBallTypes[kBallTypeIDs.GOLD],
			"Gold balls are worth double points and don't count towards the max balls limit.",
			/*cost_func=*/function() {
				return 500000;
			},
			/*visible_func=*/function() {
				return GetUpgradeLevel("max_balls") > 0;
			}));
	upgrades_list.push(new BallTypeRateUpgrade(
			/*ball_type=*/kBallTypes[kBallTypeIDs.GOLD],
			/*cost_func=*/function(level) {
				return 1000000 * Math.pow(2, level);
			},
			/*value_func=*/function(level) {
				return level + 1;
			},
			/*max_level=*/49));
	upgrades_list.push(new Upgrade("gold_ball_value", "Gold Ball Value",
			/*category=*/"gold_balls",
			/*description=*/"Increases point multiplier for gold balls.",
			/*cost_func=*/function(level) {
				return 10000000 * Math.pow(10, level);
			},
			/*value_func=*/function(level) {
				return level + 2;
			},
			/*max_level=*/Infinity,
			/*value_suffix=*/kTimesSymbol,
			/*visible_func=*/function() {
				return IsUnlocked("unlock_gold_balls");
			},
			/*on_update=*/function() {
				state.special_ball_multiplier = this.GetValue();
				state.bonus_wheel.UpdateAllSpaces();
			},
			/*on_buy=*/null));
	upgrades_list.push(new FixedCostFeatureUnlockUpgrade("unlock_bonus_wheel", "Unlock Bonus Wheel",
			/*category=*/"bonus_wheel",
			/*description=*/"Unlocks the Bonus Wheel. Also adds 2 targets, which award a spin for each ball that passes through them. Point values on the wheel scale based on your upgrades.",
			/*cost=*/2000000,
			/*visible_func=*/function() {
				return IsUnlocked("unlock_gold_balls");
			},
			/*on_update=*/function() {
				let unlocked = (this.GetValue() > 0);
				document.getElementById("bonus_wheel").style.display = unlocked ? "inline" : "none";
				let spin_targets = state.target_sets[1].targets;
				console.assert(spin_targets.length == 3);
				spin_targets[0].active = unlocked;
				spin_targets[2].active = unlocked;
				UpdateSpinCounter();
				state.bonus_wheel.UpdateAllSpaces();
				state.redraw_targets = true;
			}));
	upgrades_list.push(new FixedCostFeatureUnlockUpgrade("add_spin_target", "Extra Spin Target",
			/*category=*/"bonus_wheel",
			/*description=*/"Adds an extra target that awards Bonus Wheel spins.",
			/*cost=*/10000000,
			/*visible_func=*/function() {
				return IsUnlocked("unlock_bonus_wheel");
			},
			/*on_update=*/function() {
				let unlocked = (this.GetValue() > 0);
				document.getElementById("bonus_wheel").style.display = unlocked ? "inline" : "none";
				let spin_targets = state.target_sets[1].targets;
				console.assert(spin_targets.length == 3);
				spin_targets[1].active = unlocked;
				state.redraw_targets = true;
			}));
	upgrades_list.push(new ToggleUnlockUpgrade("auto_spin", "Auto-Spin",
			/*category=*/"bonus_wheel",
			/*description=*/"Automatically spin the Bonus Wheel.",
			/*cost=*/50000000,
			/*visible_func=*/function() {
				return IsUnlocked("unlock_bonus_wheel");
			},
			/*on_update=*/null));
	upgrades_list.push(new ToggleUnlockUpgrade("multi_spin", "Multi-Spin",
			/*category=*/"bonus_wheel",
			/*description=*/"Uses 10% of your available spins at a time, multiplying any points you win from that spin. NOTE: Bonus gold ball drops are not multiplied.",
			/*cost=*/50000000,
			/*visible_func=*/function() {
				return IsUnlocked("unlock_bonus_wheel");
			},
			/*on_update=*/null));
	upgrades_list.push(new BallTypeUnlockUpgrade(
			/*ball_type=*/kBallTypes[kBallTypeIDs.RUBY],
			"Ruby balls are worth the same as a gold ball, plus if a ruby ball falls in the center slot, it activates a buff that doubles all points scored for 60 seconds.",
			/*cost_func=*/GemstoneBallUnlockCost,
			/*visible_func=*/ShouldDisplayGemstoneBallUpgrades));
	upgrades_list.push(new BallTypeRateUpgrade(
			/*ball_type=*/kBallTypes[kBallTypeIDs.RUBY],
			/*cost_func=*/Tier1GemstoneBallRateCostFunc,
			/*value_func=*/GemstoneBallRateValueFunc,
			/*max_level=*/49));
	upgrades_list.push(new BallTypeUnlockUpgrade(
			/*ball_type=*/kBallTypes[kBallTypeIDs.SAPPHIRE],
			"Sapphire balls are worth the same as a gold ball, plus the gold ball multiplier is also applied to any bonus wheel spins earned.",
			/*cost_func=*/GemstoneBallUnlockCost,
			/*visible_func=*/ShouldDisplayGemstoneBallUpgrades));
	upgrades_list.push(new BallTypeRateUpgrade(
			/*ball_type=*/kBallTypes[kBallTypeIDs.SAPPHIRE],
			/*cost_func=*/Tier1GemstoneBallRateCostFunc,
			/*value_func=*/GemstoneBallRateValueFunc,
			/*max_level=*/49));
	upgrades_list.push(new BallTypeUnlockUpgrade(
			/*ball_type=*/kBallTypes[kBallTypeIDs.EMERALD],
			"Points scored by emerald balls are multiplied by the square of the gold ball multiplier.",
			/*cost_func=*/GemstoneBallUnlockCost,
			/*visible_func=*/ShouldDisplayGemstoneBallUpgrades));
	upgrades_list.push(new BallTypeRateUpgrade(
			/*ball_type=*/kBallTypes[kBallTypeIDs.EMERALD],
			/*cost_func=*/Tier1GemstoneBallRateCostFunc,
			/*value_func=*/GemstoneBallRateValueFunc,
			/*max_level=*/49));
	upgrades_list.push(new BallTypeUnlockUpgrade(
			/*ball_type=*/kBallTypes[kBallTypeIDs.TOPAZ],
			"Topaz balls have the bonuses of both ruby and emerald balls.",
			/*cost_func=*/GemstoneBallUnlockCost,
			/*visible_func=*/function() {
				return IsUnlocked("unlock_ruby_balls") && IsUnlocked("unlock_emerald_balls");
			}));
	upgrades_list.push(new BallTypeRateUpgrade(
			/*ball_type=*/kBallTypes[kBallTypeIDs.TOPAZ],
			/*cost_func=*/Tier2GemstoneBallRateCostFunc,
			/*value_func=*/GemstoneBallRateValueFunc,
			/*max_level=*/49));
	upgrades_list.push(new BallTypeUnlockUpgrade(
			/*ball_type=*/kBallTypes[kBallTypeIDs.TURQUOISE],
			"Turquoise balls have the bonuses of both emerald and sapphire balls.",
			/*cost_func=*/GemstoneBallUnlockCost,
			/*visible_func=*/function() {
				return IsUnlocked("unlock_emerald_balls") && IsUnlocked("unlock_sapphire_balls");
			}));
	upgrades_list.push(new BallTypeRateUpgrade(
			/*ball_type=*/kBallTypes[kBallTypeIDs.TURQUOISE],
			/*cost_func=*/Tier2GemstoneBallRateCostFunc,
			/*value_func=*/GemstoneBallRateValueFunc,
			/*max_level=*/49));
	upgrades_list.push(new BallTypeUnlockUpgrade(
			/*ball_type=*/kBallTypes[kBallTypeIDs.AMETHYST],
			"Amethyst balls have the bonuses of both ruby and sapphire balls.",
			/*cost_func=*/GemstoneBallUnlockCost,
			/*visible_func=*/function() {
				return IsUnlocked("unlock_ruby_balls") && IsUnlocked("unlock_sapphire_balls");
			}));
	upgrades_list.push(new BallTypeRateUpgrade(
			/*ball_type=*/kBallTypes[kBallTypeIDs.AMETHYST],
			/*cost_func=*/Tier2GemstoneBallRateCostFunc,
			/*value_func=*/GemstoneBallRateValueFunc,
			/*max_level=*/49));
	upgrades_list.push(new BallTypeUnlockUpgrade(
			/*ball_type=*/kBallTypes[kBallTypeIDs.OPAL],
			"Opal balls have the combined bonuses of ruby, sapphire, and emerald balls.",
			/*cost_func=*/GemstoneBallUnlockCost,
			/*visible_func=*/AllTier2GemstoneBallsUnlocked));
	upgrades_list.push(new BallTypeRateUpgrade(
			/*ball_type=*/kBallTypes[kBallTypeIDs.OPAL],
			/*cost_func=*/function (level) {
				return 5e24 * Math.pow(5, level);
			},
			/*value_func=*/GemstoneBallRateValueFunc,
			/*max_level=*/49));
	
	let upgrades_map = {};
	for (let i = 0; i < upgrades_list.length; ++i) {
		let upgrade = upgrades_list[i];
		upgrades_map[upgrade.id] = upgrade;
	}
	
	return upgrades_map;
}

function ButtonClassForUpgradeCategory(category) {
	if (category == "ruby_balls") {
		return "rubyUpgradeButton";
	} else if (category == "sapphire_balls") {
		return "sapphireUpgradeButton";
	} else if (category == "emerald_balls") {
		return "emeraldUpgradeButton";
	} else if (category == "topaz_balls") {
		return "topazUpgradeButton";
	} else if (category == "turquoise_balls") {
		return "turquoiseUpgradeButton";
	} else if (category == "amethyst_balls") {
		return "amethystUpgradeButton";
	} else if (category == "opal_balls") {
		return "opalUpgradeButton";
	} else {
		return "upgradeButton";
	}
}

function InitUpgradeButtons(upgrades) {
	for (let upgrade_id in upgrades) {
		let upgrade = upgrades[upgrade_id];
		let category_div = document.getElementById(upgrade.category + "_contents");
		let button_class = ButtonClassForUpgradeCategory(upgrade.category);
		category_div.innerHTML += '<div class="upgradeButtonWrapper" id="' + upgrade_id +
				'" onmouseenter="ShowUpgradeTooltip(this)" onmouseleave="HideUpgradeTooltip(this)">' +
				'<button type="button" class="' + button_class + '" id="button_upgrade_' +
				upgrade.id + '" onclick="UpgradeButtonHandler(this)"></button></div>'
	}
}

function UpdateBottomTargets() {
	let bottom_targets = state.target_sets[0].targets;
	console.assert(bottom_targets.length == 9);
	let multiplier_upgrade = state.upgrades["multiplier"];
	let multiplier = multiplier_upgrade.GetValue();
	let center_value_upgrade = state.upgrades["center_value"];
	for (let i = 0; i < kBaseSlotValues.length; ++i) {
		let base_value = kBaseSlotValues[i];
		if (i == 4) {
			base_value = center_value_upgrade.GetValue();
		}
		bottom_targets[i].SetValue(base_value * multiplier);
	}
	state.redraw_targets = true;
}

function UpgradeButtonHandler(elem) {
	const kPrefix = "button_upgrade_";
	console.assert(elem.id.indexOf(kPrefix) == 0);
	let upgrade_id = elem.id.slice(kPrefix.length);
	state.upgrades[upgrade_id].OnClick();
}

function UpdateUpgradeSubHeader(header_id, visible) {
	let elem = document.getElementById(header_id);
	elem.style.display = visible ? "inline-block" : "none";
}

function UpdateUpgradeButtons(state) {
	if (!state.update_upgrade_buttons) {
		return;
	}
	state.update_upgrade_buttons = false;
	
	for (let id in state.upgrades) {
		let upgrade = state.upgrades[id];
		let elem = document.getElementById("button_upgrade_" + id);
		elem.innerHTML = upgrade.GetText();
		elem.disabled = !upgrade.ShouldEnableButton();
		elem.style.display = upgrade.visible_func() ? "inline" : "none";
	}
	UpdateUpgradeSubHeader("basic_upgrades_container", true);
	UpdateUpgradeSubHeader("auto-drop_upgrades_container", state.upgrades["auto_drop"].visible_func());
	UpdateUpgradeSubHeader("bonus_wheel_upgrades_container", state.upgrades["unlock_bonus_wheel"].visible_func());
	UpdateUpgradeSubHeader("gold_balls_upgrades_container", state.upgrades["unlock_gold_balls"].visible_func());
	UpdateUpgradeSubHeader("gemstone_balls_upgrades_container", ShouldDisplayGemstoneBallUpgrades());
}

function ShowUpgradeTooltip(elem) {
	state.active_tooltip = elem.id;
	const kWidth = 200;
	let body_rect = document.body.getBoundingClientRect();
	let button_rect = elem.getBoundingClientRect();
	let tooltip_elem = document.getElementById("tooltip")
	tooltip_elem.style.width = kWidth + "px";
	let left_pos = (button_rect.left + button_rect.right - kWidth) / 2.0;
	tooltip_elem.style.display = "block";
	tooltip_elem.innerHTML = state.upgrades[elem.id].description;
	tooltip_elem.style.left = left_pos + "px";
	tooltip_elem.style.top = (button_rect.top - tooltip_elem.offsetHeight - 5) + "px";
}

function HideUpgradeTooltip(button_elem) {
	if (state.active_tooltip != button_elem.id) {
		return;
	}
	document.getElementById("tooltip").style.display = "none";
}
