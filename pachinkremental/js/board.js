const kPegRadius = 1.5;
const kBallRadius = 5.5;

const kCellSize = 8.0;

class Target {
	constructor(pos, draw_radius, hitbox_radius, color, text, id, active, on_hit) {
		this.pos = pos;
		this.draw_radius = draw_radius;
		this.hitbox_radius = hitbox_radius;
		this.hitbox_radius_sqr = hitbox_radius * hitbox_radius;
		this.color = color;
		this.text = text;
		this.id = id;
		this.active = active;
		this.on_hit = on_hit;
	}
	
	CheckForHit(ball) {
		if (!this.active) {
			return;
		}
		if (this.id == ball.last_hit) {
			return;
		}
		if (this.pos.DistanceSqrToPoint(ball.pos) < this.hitbox_radius_sqr) {
			if (state.save_file.stats.target_hits[this.id]) {
				++state.save_file.stats.target_hits[this.id];
			} else {
				state.save_file.stats.target_hits[this.id] = 1;
			}
			
			this.on_hit(ball);
			ball.last_hit = this.id;
		}
	}
}

class ScoreTarget extends Target {
	constructor(pos, draw_radius, hitbox_radius, color, id, active, value) {
		super(pos, draw_radius, hitbox_radius, color, /*text=*/FormatNumberShort(value), id, active, /*on_hit=*/null);
		this.on_hit = this.OnHit;
		this.value = value;
	}

	OnHit(ball) {
		ball.active = false;
		var total_value = this.value;
		var color_rgb = "0,128,0";
		if (state.save_file.score_buff_multiplier > 1 && state.save_file.score_buff_duration > 0) {
			total_value *= state.save_file.score_buff_multiplier;
		}
		let popup_text_level = 0;
		if (ball.ball_type_index != kBallTypeIDs.NORMAL) {
			popup_text_level = 1;
			total_value *= state.special_ball_multiplier;
			color_rgb = "170,143,0";
			if (ball.ball_type_index == kBallTypeIDs.EMERALD ||
					ball.ball_type_index == kBallTypeIDs.TOPAZ ||
					ball.ball_type_index == kBallTypeIDs.TURQUOISE||
					ball.ball_type_index == kBallTypeIDs.OPAL) {
				total_value *= state.special_ball_multiplier;
				popup_text_level = 2;
				color_rgb = "0,192,0";
			}
			if (this.id == 4) {
				OnCenterSlotHit(ball);
			}
		}
		AddScore(total_value);
		MaybeAddScoreText(popup_text_level, "+" + FormatNumberShort(total_value), ball.pos, color_rgb);
	}
	
	SetValue(new_value) {
		this.value = new_value;
		this.text = FormatNumberShort(new_value);
	}
}

class SpinTarget extends Target {
	constructor(pos, draw_radius, hitbox_radius, color, id) {
		
		super(pos, draw_radius, hitbox_radius, color, /*text=*/"Spin", id, /*on_hit=*/null);
		this.on_hit = this.OnHit;
	}

	OnHit(ball) {
		if (ball.ball_type_index == kBallTypeIDs.SAPPHIRE ||
				ball.ball_type_index == kBallTypeIDs.TURQUOISE ||
				ball.ball_type_index == kBallTypeIDs.AMETHYST ||
				ball.ball_type_index == kBallTypeIDs.OPAL) {
			let value = state.special_ball_multiplier;
			state.save_file.spins += value;
			UpdateSpinCounter();
			MaybeAddScoreText(/*level=*/2, "+" + value + " Spins", ball.pos, "0,0,255");
		} else {
			++state.save_file.spins;
			UpdateSpinCounter();
			MaybeAddScoreText(/*level=*/0, "+1 Spin", ball.pos, "0,170,0");
		}
	}
}

class TargetSet {
	constructor(targets) {
		this.targets = targets;
		let radius = targets[0].hitbox_radius;
		this.min_x = targets[0].pos.x - radius;
		this.max_x = targets[0].pos.x + radius;
		this.min_y = targets[0].pos.y - radius;
		this.max_y = targets[0].pos.y + radius;
		for (let i = 1; i < targets.length; ++i) {
			let radius = targets[i].hitbox_radius;
			this.min_x = Math.min(this.min_x, targets[i].pos.x - radius);
			this.max_x = Math.max(this.max_x, targets[i].pos.x + radius);
			this.min_y = Math.min(this.min_y, targets[i].pos.y - radius);
			this.max_y = Math.max(this.max_y, targets[i].pos.y + radius);
		}
	}
}

class PegBoard {
	constructor(width, height, pegs) {
		this.width = width;
		this.height = height;
		this.pegs = pegs;
		this.grid_cols = Math.ceil(width / kCellSize);
		this.grid_rows = Math.ceil(height / kCellSize);
		this.cache = [...Array(this.grid_rows * this.grid_cols)].map(_ => Array(0))
		for (let i = 0; i < pegs.length; ++i) {
			const peg = pegs[i];
			if (peg.x < 0 || peg.x > width || peg.y < 0 || peg.y > height) {
				console.log("Skipping out-of-bounds peg at (" + peg.x + ", " + peg.y + ")");
				continue;
			}
			const row = Math.floor(peg.y / kCellSize);
			const col = Math.floor(peg.x / kCellSize);
			this.GetCacheCell(row, col).push(peg);
		}
	}

	GetCacheCell(row, col) {
		return this.cache[row * this.grid_cols + col];
	}

	FindPegsWithinRadius(pt, radius) {
		const rad_sqr = radius * radius;
		let result = Array(0);
		let min_row = Math.floor((pt.y - radius) / kCellSize);
		if (min_row < 0) min_row = 0;
		let max_row = Math.floor((pt.y + radius) / kCellSize);
		if (max_row >= this.grid_rows) max_row = this.grid_rows - 1;
		let min_col = Math.floor((pt.x - radius) / kCellSize);
		if (min_col < 0) min_col = 0;
		let max_col = Math.floor((pt.x + radius) / kCellSize);
		if (max_col >= this.grid_cols) max_col = this.grid_cols - 1;
		for (let row = min_row; row <= max_row; row++) {
			for (let col = min_col; col <= max_col; col++) {
				let cell = this.GetCacheCell(row, col);
				for (let i = 0; i < cell.length; ++i) {
					if (cell[i].DistanceSqrToPoint(pt) < rad_sqr) {
						result.push(cell[i]);
					}
				}
			}
		}
		return result;
	}

	FindNearestPeg(pt, max_radius) {
		let result = null;
		let result_dist_sqr = max_radius * max_radius;
		let min_row = Math.floor((pt.y - max_radius) / kCellSize);
		if (min_row < 0) min_row = 0;
		let max_row = Math.floor((pt.y + max_radius) / kCellSize);
		if (max_row >= this.grid_rows) max_row = this.grid_rows - 1;
		let min_col = Math.floor((pt.x - max_radius) / kCellSize);
		if (min_col < 0) min_col = 0;
		let max_col = Math.floor((pt.x + max_radius) / kCellSize);
		if (max_col >= this.grid_cols) max_col = this.grid_cols - 1;
		for (let row = min_row; row <= max_row; row++) {
			for (let col = min_col; col <= max_col; col++) {
				let cell = this.GetCacheCell(row, col);
				for (let i = 0; i < cell.length; ++i) {
					let dist_sqr = cell[i].DistanceSqrToPoint(pt);
					if (dist_sqr < result_dist_sqr) {
						result = cell[i];
						result_dist_sqr = dist_sqr;
					}
				}
			}
		}
		return result;
	}
}

const kHorizontalSpacing = 18;
const kWallSpacing = 4;
const kHalfWallSpace = kWallSpacing / 2;
const kVerticalSpacing = Math.sqrt(3) * kHorizontalSpacing / 2;
const kColumns = 9;
const kRows = 13;
const kBottomSlotRows = 5;
const kWidth = kHorizontalSpacing * kColumns + kWallSpacing;
const kHeight = 256;
const kBaseSlotValues = [20, 100, 200, 1, 250, 1, 200, 100, 20];

function DefaultBoard() {
	let pegs = Array(0);
	for (let y = kHeight - kHalfWallSpace; y >= kHalfWallSpace; y -= kWallSpacing) {
		pegs.push(new Point(kHalfWallSpace, y));
		pegs.push(new Point(kWidth - kHalfWallSpace, y));
	}
	var y = kHeight - kHalfWallSpace;
	for (let col = 0; col < kColumns; ++col) {
		const prev_x = col * kHorizontalSpacing + kHalfWallSpace;
		const next_x = (col + 1) * kHorizontalSpacing + kHalfWallSpace;
		const delta_x = next_x - prev_x;
		const mid_pegs = Math.floor(delta_x / kWallSpacing);
		for (let subcol = 1; subcol <= mid_pegs; ++subcol) {
			const x = prev_x + (subcol * delta_x / mid_pegs);
			pegs.push(new Point(x, y));
		}
	}
	y -= kWallSpacing;
	for (let row = 1; row < kBottomSlotRows; ++row) {
		for (let col = 1; col < kColumns; ++col) {
			const x = col * kHorizontalSpacing + kHalfWallSpace;
			pegs.push(new Point(x, y));
		}
		y -= kWallSpacing;
	}
	for (let row = 0; row < kRows; ++row) {
		if (row % 2 == 0) {
			for (let col = 1; col < kColumns; ++col) {
				const x = col * kHorizontalSpacing + kHalfWallSpace;
				pegs.push(new Point(x, y));
			}
		} else {
			for (let col = 0; col < kColumns; ++col) {
				const x = (col + 0.5) * kHorizontalSpacing + kHalfWallSpace;
				pegs.push(new Point(x, y));
			}
			const y_above = y - kVerticalSpacing / 4;
			const x_left = 0.25 * kHorizontalSpacing + kHalfWallSpace;
			const x_right = kWidth - x_left;
			pegs.push(new Point(x_left, y_above));
			pegs.push(new Point(x_right, y_above));
		}
		y -= kVerticalSpacing;
	}
	max_drop_y = y;
	min_drop_x = 10;
	max_drop_x = kWidth - 10;
	return new PegBoard(kWidth, kHeight, pegs);
}

function DefaultTargets() {
	const kDrawRadius = (kHorizontalSpacing - kWallSpacing) / 2;
	const kTargetColor = "#8FF";
	const kHitboxRadius = Math.min(kDrawRadius * 1.5 - kBallRadius);

	let target_sets = Array(0);
	
	const kBottomTargetY = kHeight - kDrawRadius - kWallSpacing;
	let bottom_targets = Array(0);
	for (let col = 0; col < kBaseSlotValues.length; ++col) {
		const x = (col + 0.5) * kHorizontalSpacing + kHalfWallSpace;
		const pos = new Point(x, kBottomTargetY);
		const value = kBaseSlotValues[col];
		bottom_targets.push(new ScoreTarget(
				pos, kDrawRadius, kHitboxRadius, kTargetColor, col, /*active=*/true, value));
	}
	target_sets.push(new TargetSet(bottom_targets));
	
	const kSpinTargetColor = "rgba(0, 0, 255, 0.5)";
	const kSpinTargetY = kHeight - (kWallSpacing * (kBottomSlotRows + 0.5)) - kVerticalSpacing * 2;
	let spin_targets = Array(0);
	const left_x = 1.5 * kHorizontalSpacing + kHalfWallSpace;
	const center_x = 4.5 * kHorizontalSpacing + kHalfWallSpace;
	const right_x = 7.5 * kHorizontalSpacing + kHalfWallSpace;
	spin_targets.push(new SpinTarget(
			new Point(left_x, kSpinTargetY), kDrawRadius, kHitboxRadius, kSpinTargetColor, "spin_left"));
	spin_targets.push(new SpinTarget(
			new Point(center_x, kSpinTargetY), kDrawRadius, kHitboxRadius, kSpinTargetColor, "spin_center"));
	spin_targets.push(new SpinTarget(
			new Point(right_x, kSpinTargetY), kDrawRadius, kHitboxRadius, kSpinTargetColor, "spin_right"));
	target_sets.push(new TargetSet(spin_targets));

	return target_sets;
}
