import { moment as obsidianMoment } from 'obsidian'
import type momentFactory from 'moment'

// Obsidian exposes the callable Moment singleton, but its declaration is a namespace import.
export const moment = obsidianMoment as unknown as typeof momentFactory
