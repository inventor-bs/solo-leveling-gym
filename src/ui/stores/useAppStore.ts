import { create } from "zustand";

export type Rank = "E" | "D" | "C" | "B" | "A" | "S" | "National" | "Monarch";

export interface Stats {
  strength: number;
  agility: number;
  vitality: number;
  intelligence: number;
  perception: number;
  luck: number;
}

export interface ShadowSoldier {
  id: string;
  name: string;
  grade: string;
  muscleGroup: string;
  level: number;
  maxLevel: number;
  lastTrained: string | null;
  unlocked: boolean;
  icon: string;
}

export interface Quest {
  id: string;
  type: "main" | "side" | "hidden" | "emergency";
  title: string;
  description: string;
  systemMessage?: string;
  requirements: { label: string; current: number; total: number; unit: string }[];
  reward: { exp: number; gold: number; stat?: string };
  expiresIn: number; // hours
  completed: boolean;
}

export interface InventoryItem {
  id: string;
  name: string;
  type: "consumable" | "equipment" | "special";
  grade: "common" | "uncommon" | "rare" | "epic" | "legendary";
  quantity: number;
  icon: string;
  effect: string;
}

export interface WorkoutSet {
  reps: number;
  weight: number;
  completed: boolean;
}

export interface ActiveExercise {
  id: string;
  name: string;
  sets: WorkoutSet[];
  targetMuscle: string;
}

interface AppState {
  // Hunter profile
  hunterName: string;
  rank: Rank;
  level: number;
  currentExp: number;
  maxExp: number;
  gold: number;
  title: string;
  stats: Stats;
  statPoints: number;

  // Quests
  quests: Quest[];
  streakDays: number;
  penaltyZoneActive: boolean;

  // Shadow Army
  shadowArmy: ShadowSoldier[];

  // Inventory
  inventory: InventoryItem[];

  // Active dungeon
  activeDungeon: {
    name: string;
    rank: Rank;
    type: string;
    exercises: ActiveExercise[];
    startTime: number | null;
    active: boolean;
  };

  // Notifications
  notifications: { id: string; message: string; type: "info" | "warning" | "danger" | "success" }[];

  // Actions
  completeQuest: (questId: string) => void;
  toggleSet: (exerciseId: string, setIndex: number) => void;
  startDungeon: () => void;
  completeDungeon: () => void;
  addNotification: (message: string, type: "info" | "warning" | "danger" | "success") => void;
  removeNotification: (id: string) => void;
}

const SHADOW_ARMY: ShadowSoldier[] = [
  { id: "igris", name: "Igris", grade: "Elite Knight", muscleGroup: "Chest", level: 7, maxLevel: 20, lastTrained: "2024-01-04", unlocked: true, icon: "⚔️" },
  { id: "iron", name: "Iron", grade: "Elite Warrior", muscleGroup: "Legs", level: 5, maxLevel: 20, lastTrained: "2024-01-03", unlocked: true, icon: "🦵" },
  { id: "tank", name: "Tank", grade: "Elite Guardian", muscleGroup: "Back", level: 6, maxLevel: 20, lastTrained: "2024-01-02", unlocked: true, icon: "🛡️" },
  { id: "beru", name: "Beru", grade: "Elite Assassin", muscleGroup: "Shoulders", level: 4, maxLevel: 20, lastTrained: "2024-01-01", unlocked: true, icon: "💪" },
  { id: "tusk", name: "Tusk", grade: "Elite Berserker", muscleGroup: "Arms", level: 3, maxLevel: 20, lastTrained: "2023-12-30", unlocked: true, icon: "💥" },
  { id: "greed", name: "Greed", grade: "Shadow Mage", muscleGroup: "Core", level: 2, maxLevel: 20, lastTrained: "2023-12-28", unlocked: true, icon: "🔥" },
  { id: "kaisel", name: "Kaisel", grade: "Shadow Dragon", muscleGroup: "Cardio", level: 1, maxLevel: 20, lastTrained: null, unlocked: true, icon: "🐉" },
  { id: "unknown1", name: "???", grade: "Unknown", muscleGroup: "Calves", level: 0, maxLevel: 20, lastTrained: null, unlocked: false, icon: "❓" },
  { id: "unknown2", name: "???", grade: "Unknown", muscleGroup: "Glutes", level: 0, maxLevel: 20, lastTrained: null, unlocked: false, icon: "❓" },
];

const QUESTS: Quest[] = [
  {
    id: "main-1",
    type: "main",
    title: "Trial of the Iron Monarch",
    description: "The System demands progression. Your chest has shown stagnation. Break through — or remain E-Rank forever.",
    systemMessage: "Hunter Nguyen. Your plateau has been detected. Today you will surpass your limits.",
    requirements: [
      { label: "Bench Press", current: 0, total: 4, unit: "sets × 6 reps" },
      { label: "Incline DB Press", current: 0, total: 3, unit: "sets × 10 reps" },
      { label: "Cable Fly", current: 0, total: 3, unit: "sets × 15 reps" },
    ],
    reward: { exp: 450, gold: 75, stat: "STR +3" },
    expiresIn: 18,
    completed: false,
  },
  {
    id: "side-1",
    type: "side",
    title: "Hydration Protocol",
    description: "Mana recovery insufficient. Consume 2.5L of water.",
    requirements: [{ label: "Water consumed", current: 1.2, total: 2.5, unit: "liters" }],
    reward: { exp: 80, gold: 15 },
    expiresIn: 18,
    completed: false,
  },
  {
    id: "side-2",
    type: "side",
    title: "Shadow Rest Protocol",
    description: "Shadows require sleep to grow. The System demands 7+ hours tonight.",
    requirements: [{ label: "Sleep", current: 0, total: 7, unit: "hours" }],
    reward: { exp: 120, gold: 20, stat: "END +1" },
    expiresIn: 18,
    completed: false,
  },
  {
    id: "hidden-1",
    type: "hidden",
    title: "???",
    description: "Conditions unknown. The System watches.",
    requirements: [{ label: "???", current: 0, total: 1, unit: "" }],
    reward: { exp: 500, gold: 100 },
    expiresIn: 18,
    completed: false,
  },
];

const INVENTORY: InventoryItem[] = [
  { id: "hp-mid", name: "Mid-Grade Recovery Potion", type: "consumable", grade: "uncommon", quantity: 3, icon: "💊", effect: "Restore HP +200. Reduces muscle soreness." },
  { id: "mana-elixir", name: "Mana Elixir", type: "consumable", grade: "rare", quantity: 1, icon: "🧪", effect: "Pre-workout boost. +15% performance for 1 hour." },
  { id: "protein-potion", name: "High-Protein Concentrate", type: "consumable", grade: "common", quantity: 5, icon: "🥛", effect: "+25g protein. STR recovery accelerated." },
  { id: "knight-killer", name: "Iron Grips", type: "equipment", grade: "rare", quantity: 1, icon: "🧤", effect: "Deadlift grip enhanced. +10% back engagement." },
  { id: "shadow-armor", name: "Shadow Compression Gear", type: "equipment", grade: "epic", quantity: 1, icon: "🦺", effect: "Core stability +25%. Posture corrected." },
  { id: "ancient-scroll", name: "Form Codex — Deadlift", type: "special", grade: "epic", quantity: 1, icon: "📜", effect: "Master deadlift form. INT +5, PER +3." },
];

export const useAppStore = create<AppState>((set) => ({
  hunterName: "Jin-Woo",
  rank: "B",
  level: 28,
  currentExp: 6200,
  maxExp: 8500,
  gold: 1247,
  title: "Knight of the Shadows",
  stats: {
    strength: 74,
    agility: 61,
    vitality: 58,
    intelligence: 42,
    perception: 55,
    luck: 30,
  },
  statPoints: 3,
  quests: QUESTS,
  streakDays: 12,
  penaltyZoneActive: false,
  shadowArmy: SHADOW_ARMY,
  inventory: INVENTORY,
  activeDungeon: {
    name: "The Catacombs of Iron — Chest Dungeon",
    rank: "B",
    type: "Hypertrophy",
    startTime: null,
    active: false,
    exercises: [
      {
        id: "bench", name: "Bench Press", targetMuscle: "Chest",
        sets: [
          { reps: 6, weight: 80, completed: false },
          { reps: 6, weight: 80, completed: false },
          { reps: 6, weight: 80, completed: false },
          { reps: 6, weight: 80, completed: false },
        ],
      },
      {
        id: "incline", name: "Incline DB Press", targetMuscle: "Upper Chest",
        sets: [
          { reps: 10, weight: 32, completed: false },
          { reps: 10, weight: 32, completed: false },
          { reps: 10, weight: 32, completed: false },
        ],
      },
      {
        id: "fly", name: "Cable Fly", targetMuscle: "Chest",
        sets: [
          { reps: 15, weight: 15, completed: false },
          { reps: 15, weight: 15, completed: false },
          { reps: 15, weight: 15, completed: false },
        ],
      },
    ],
  },
  notifications: [],

  completeQuest: (questId) =>
    set((state) => ({
      quests: state.quests.map((q) =>
        q.id === questId ? { ...q, completed: true } : q
      ),
      currentExp: Math.min(state.currentExp + 200, state.maxExp),
      gold: state.gold + 50,
    })),

  toggleSet: (exerciseId, setIndex) =>
    set((state) => ({
      activeDungeon: {
        ...state.activeDungeon,
        exercises: state.activeDungeon.exercises.map((ex) =>
          ex.id === exerciseId
            ? {
                ...ex,
                sets: ex.sets.map((s, i) =>
                  i === setIndex ? { ...s, completed: !s.completed } : s
                ),
              }
            : ex
        ),
      },
    })),

  startDungeon: () =>
    set((state) => ({
      activeDungeon: { ...state.activeDungeon, active: true, startTime: Date.now() },
    })),

  completeDungeon: () =>
    set((state) => ({
      activeDungeon: { ...state.activeDungeon, active: false },
      currentExp: Math.min(state.currentExp + 450, state.maxExp),
      gold: state.gold + 75,
    })),

  addNotification: (message, type) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        { id: Math.random().toString(36), message, type },
      ],
    })),

  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}));
