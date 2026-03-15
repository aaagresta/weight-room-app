'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

type ExerciseOption = {
  id: string
  name: string
  category: string | null
}

type WorkoutSet = {
  id: string
  setNumber: number
  targetReps: string
  percent: string
  useMax: boolean
  maxLift: string
}

type WorkoutExercise = {
  id: string
  name: string
  sets: WorkoutSet[]
}

type SavedWorkoutSet = {
  setNumber: number
  targetReps: number
  percent: number | null
  useMax: boolean
  maxLift: string | null
}

type SavedWorkoutExercise = {
  name: string
  sets: SavedWorkoutSet[]
}

type DailyWorkout = {
  id: string
  workout_date: string
  team_level: string
  title: string
  workout_data: {
    exercises: SavedWorkoutExercise[]
  }
}

const MAIN_LIFTS = [
  'Bench Press',
  'Back Squat',
  'Deadlift',
  'Hang Clean',
  'Front Squat',
  'Overhead Press',
]

function makeSet(setNumber: number): WorkoutSet {
  return {
    id: crypto.randomUUID(),
    setNumber,
    targetReps: '',
    percent: '',
    useMax: false,
    maxLift: '',
  }
}

function makeExercise(): WorkoutExercise {
  return {
    id: crypto.randomUUID(),
    name: '',
    sets: [makeSet(1)],
  }
}

function normalizeExerciseRows(rows: any[] | null | undefined): ExerciseOption[] {
  return (rows || [])
    .map((row) => ({
      id: String(row.id),
      name: row.name || row.exercise_name || row.title || 'Unnamed Exercise',
      category: row.category || row.type || null,
    }))
    .filter((row) => row.name && row.name !== 'Unnamed Exercise')
}

export default function AssignWorkoutPage() {
  const today = new Date().toISOString().split('T')[0]

  const [date, setDate] = useState(today)
  const [team, setTeam] = useState('Varsity')
  const [title, setTitle] = useState('')
  const [exercises, setExercises] = useState<WorkoutExercise[]>([makeExercise()])
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>([])
  const [message, setMessage] = useState('')
  const [savedWorkouts, setSavedWorkouts] = useState<DailyWorkout[]>([])
  const [loading, setLoading] = useState(true)
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null)

  useEffect(() => {
    loadPageData()
  }, [])

  async function loadPageData() {
    setLoading(true)
    setMessage('')

    const [workoutsResult, exercisesResult, legacyExercisesResult] = await Promise.all([
      supabase
        .from('daily_workouts')
        .select('*')
        .order('workout_date', { ascending: false }),

      supabase
        .from('exercises')
        .select('*'),

      supabase
        .from('exercise_library')
        .select('*'),
    ])

    if (workoutsResult.error) {
      console.error(workoutsResult.error)
      setMessage(`Error loading workouts: ${workoutsResult.error.message}`)
      setSavedWorkouts([])
    } else {
      setSavedWorkouts((workoutsResult.data as DailyWorkout[]) || [])
    }

    const currentExercises = exercisesResult.error ? [] : normalizeExerciseRows(exercisesResult.data as any[])
    const legacyExercises = legacyExercisesResult.error ? [] : normalizeExerciseRows(legacyExercisesResult.data as any[])

    const merged = [...currentExercises, ...legacyExercises]
    const uniqueMap = new Map<string, ExerciseOption>()

    merged.forEach((exercise) => {
      const key = exercise.name.trim().toLowerCase()
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, exercise)
      }
    })

    const mergedExercises = Array.from(uniqueMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    )

    if (mergedExercises.length === 0) {
      if (exercisesResult.error && legacyExercisesResult.error) {
        console.error('exercises table error:', exercisesResult.error)
        console.error('exercise_library table error:', legacyExercisesResult.error)
        setMessage('Exercise library could not be loaded from exercises or exercise_library.')
      }
      setExerciseOptions([])
    } else {
      setExerciseOptions(mergedExercises)
    }

    setLoading(false)
  }

  function resetForm() {
    setEditingWorkoutId(null)
    setDate(today)
    setTeam('Varsity')
    setTitle('')
    setExercises([makeExercise()])
  }

  function addExercise() {
    setExercises((prev) => [...prev, makeExercise()])
  }

  function removeExercise(exerciseId: string) {
    setExercises((prev) => {
      const next = prev.filter((exercise) => exercise.id !== exerciseId)
      return next.length > 0 ? next : [makeExercise()]
    })
  }

  function updateExerciseName(exerciseId: string, value: string) {
    setExercises((prev) =>
      prev.map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, name: value } : exercise
      )
    )
  }

  function addSet(exerciseId: string) {
    setExercises((prev) =>
      prev.map((exercise) => {
        if (exercise.id !== exerciseId) return exercise
        const nextSetNumber = exercise.sets.length + 1
        return {
          ...exercise,
          sets: [...exercise.sets, makeSet(nextSetNumber)],
        }
      })
    )
  }

  function removeSet(exerciseId: string, setId: string) {
    setExercises((prev) =>
      prev.map((exercise) => {
        if (exercise.id !== exerciseId) return exercise

        const filtered = exercise.sets.filter((set) => set.id !== setId)
        const rebuilt = (filtered.length > 0 ? filtered : [makeSet(1)]).map((set, index) => ({
          ...set,
          setNumber: index + 1,
        }))

        return {
          ...exercise,
          sets: rebuilt,
        }
      })
    )
  }

  function updateSetField(
    exerciseId: string,
    setId: string,
    field: 'targetReps' | 'percent' | 'useMax' | 'maxLift',
    value: string | boolean
  ) {
    setExercises((prev) =>
      prev.map((exercise) => {
        if (exercise.id !== exerciseId) return exercise

        return {
          ...exercise,
          sets: exercise.sets.map((set) =>
            set.id === setId ? { ...set, [field]: value } : set
          ),
        }
      })
    )
  }

  function startEditWorkout(workout: DailyWorkout) {
    setEditingWorkoutId(workout.id)
    setDate(workout.workout_date)
    setTeam(workout.team_level)
    setTitle(workout.title)

    const rebuiltExercises: WorkoutExercise[] =
      workout.workout_data?.exercises?.map((exercise, exerciseIndex) => ({
        id: `exercise-${exerciseIndex}-${crypto.randomUUID()}`,
        name: exercise.name,
        sets:
          exercise.sets?.map((set, setIndex) => ({
            id: `set-${setIndex}-${crypto.randomUUID()}`,
            setNumber: set.setNumber,
            targetReps: String(set.targetReps ?? ''),
            percent: set.percent !== null && set.percent !== undefined ? String(set.percent) : '',
            useMax: Boolean(set.useMax),
            maxLift: set.maxLift || '',
          })) || [makeSet(1)],
      })) || [makeExercise()]

    setExercises(rebuiltExercises.length > 0 ? rebuiltExercises : [makeExercise()])
    setMessage('Editing workout.')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function saveWorkout(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (!title.trim()) {
      setMessage('Workout title is required.')
      return
    }

    const cleanedExercises = exercises
      .map((exercise) => ({
        name: exercise.name.trim(),
        sets: exercise.sets
          .filter((set) => set.targetReps.trim() !== '')
          .map((set, idx) => ({
            setNumber: idx + 1,
            targetReps: Number(set.targetReps),
            percent: set.percent.trim() !== '' ? Number(set.percent) : null,
            useMax: set.useMax,
            maxLift: set.useMax ? (set.maxLift || exercise.name.trim()) : null,
          })),
      }))
      .filter((exercise) => exercise.name !== '' && exercise.sets.length > 0)

    if (cleanedExercises.length === 0) {
      setMessage('Add at least one exercise with at least one set.')
      return
    }

    if (editingWorkoutId) {
      const { error } = await supabase
        .from('daily_workouts')
        .update({
          workout_date: date,
          team_level: team,
          title: title.trim(),
          workout_data: {
            exercises: cleanedExercises,
          },
        })
        .eq('id', editingWorkoutId)

      if (error) {
        console.error(error)
        setMessage(`Error updating workout: ${error.message}`)
        return
      }

      setMessage('Workout updated successfully.')
    } else {
      const { error } = await supabase.from('daily_workouts').insert([
        {
          workout_date: date,
          team_level: team,
          title: title.trim(),
          workout_data: {
            exercises: cleanedExercises,
          },
        },
      ])

      if (error) {
        console.error(error)
        setMessage(`Error saving workout: ${error.message}`)
        return
      }

      setMessage('Workout saved successfully.')
    }

    resetForm()
    await loadPageData()
  }

  async function deleteWorkout(workoutId: string) {
    const confirmed = window.confirm('Delete this workout?')
    if (!confirmed) return

    const { error } = await supabase
      .from('daily_workouts')
      .delete()
      .eq('id', workoutId)

    if (error) {
      console.error(error)
      setMessage(`Error deleting workout: ${error.message}`)
      return
    }

    if (editingWorkoutId === workoutId) {
      resetForm()
    }

    await loadPageData()
    setMessage('Workout deleted.')
  }

  return (
    <div style={{ padding: 24, backgroundColor: '#000000', minHeight: '100vh', color: '#ffffff' }}>
      <h1 style={{ marginBottom: 8 }}>Daily Workout Builder</h1>
      <p style={{ color: '#a1a1aa', marginBottom: 20 }}>
        Build a custom workout for a specific team and date using your exercise library and max percentages.
      </p>

      <div style={panelStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 12,
          }}
        >
          <h2 style={{ margin: 0 }}>
            {editingWorkoutId ? 'Edit Daily Workout' : 'Create Daily Workout'}
          </h2>

          {editingWorkoutId && (
            <button type="button" onClick={resetForm} style={secondaryButtonStyle}>
              Cancel Edit
            </button>
          )}
        </div>

        <form onSubmit={saveWorkout}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div>
              <label style={labelStyle}>Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Team</label>
              <select value={team} onChange={(e) => setTeam(e.target.value)} style={inputStyle}>
                <option value="Varsity">Varsity</option>
                <option value="JV">JV</option>
                <option value="Freshman">Freshman</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Workout Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Example: Upper Body / Speed"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gap: 16, marginBottom: 16 }}>
            {exercises.map((exercise) => (
              <div key={exercise.id} style={exerciseCardStyle}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 10,
                    marginBottom: 12,
                    alignItems: 'center',
                  }}
                >
                  <select
                    value={exercise.name}
                    onChange={(e) => updateExerciseName(exercise.id, e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Select exercise</option>
                    {exerciseOptions.map((option) => (
                      <option key={option.id} value={option.name}>
                        {option.name}{option.category ? ` (${option.category})` : ''}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => removeExercise(exercise.id)}
                    style={deleteButtonStyle}
                  >
                    Remove Exercise
                  </button>
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  {exercise.sets.map((set) => (
                    <div
                      key={set.id}
                      style={{
                        border: '1px solid #3f3f46',
                        borderRadius: 10,
                        padding: 12,
                        backgroundColor: '#18181b',
                      }}
                    >
                      <div style={{ marginBottom: 10, fontWeight: 700 }}>Set {set.setNumber}</div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr)) auto',
                          gap: 10,
                          alignItems: 'center',
                        }}
                      >
                        <input
                          value={set.targetReps}
                          onChange={(e) =>
                            updateSetField(exercise.id, set.id, 'targetReps', e.target.value)
                          }
                          placeholder="Target reps"
                          style={inputStyle}
                        />

                        <input
                          value={set.percent}
                          onChange={(e) =>
                            updateSetField(exercise.id, set.id, 'percent', e.target.value)
                          }
                          placeholder="Percent (optional)"
                          style={inputStyle}
                        />

                        <select
                          value={set.useMax ? 'yes' : 'no'}
                          onChange={(e) =>
                            updateSetField(exercise.id, set.id, 'useMax', e.target.value === 'yes')
                          }
                          style={inputStyle}
                        >
                          <option value="no">No Max</option>
                          <option value="yes">Use Max</option>
                        </select>

                        <select
                          value={set.maxLift}
                          onChange={(e) =>
                            updateSetField(exercise.id, set.id, 'maxLift', e.target.value)
                          }
                          style={inputStyle}
                          disabled={!set.useMax}
                        >
                          <option value="">Choose max lift</option>
                          {MAIN_LIFTS.map((lift) => (
                            <option key={lift} value={lift}>
                              {lift}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => removeSet(exercise.id, set.id)}
                          style={smallDeleteButtonStyle}
                        >
                          X
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 12 }}>
                  <button type="button" onClick={() => addSet(exercise.id)} style={buttonStyle}>
                    Add Set
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={addExercise} style={buttonStyle}>
              Add Exercise
            </button>

            <button type="submit" style={buttonStyle}>
              {editingWorkoutId ? 'Save Changes' : 'Save Workout'}
            </button>
          </div>
        </form>

        {message && (
          <p style={{ marginTop: 16, color: message.startsWith('Error') ? '#f87171' : '#4ade80' }}>
            {message}
          </p>
        )}
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Saved Daily Workouts</h2>

        {loading && <p>Loading workouts...</p>}

        {!loading && savedWorkouts.length === 0 && (
          <p style={{ color: '#d4d4d8' }}>No saved workouts yet.</p>
        )}

        {!loading && savedWorkouts.length > 0 && (
          <div style={{ display: 'grid', gap: 12 }}>
            {savedWorkouts.map((workout) => (
              <div key={workout.id} style={savedWorkoutCardStyle}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{workout.title}</div>
                  <div style={{ color: '#a1a1aa' }}>
                    {workout.team_level} • {workout.workout_date}
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
                  {workout.workout_data?.exercises?.map((exercise, index) => (
                    <div key={index} style={exercisePreviewStyle}>
                      <div style={{ fontWeight: 700 }}>{exercise.name}</div>
                      <div style={{ color: '#d4d4d8' }}>
                        {exercise.sets
                          .map((set) => {
                            if (set.useMax && set.percent !== null) {
                              return `${set.targetReps} reps @ ${set.percent}%`
                            }
                            return `${set.targetReps} reps`
                          })
                          .join(' | ')}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={() => startEditWorkout(workout)} style={buttonStyle}>
                    Edit Workout
                  </button>

                  <button onClick={() => deleteWorkout(workout.id)} style={deleteButtonStyle}>
                    Delete Workout
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const panelStyle: React.CSSProperties = {
  border: '1px solid #3f3f46',
  borderRadius: 12,
  padding: 16,
  marginBottom: 20,
  backgroundColor: '#18181b',
}

const exerciseCardStyle: React.CSSProperties = {
  border: '1px solid #52525b',
  borderRadius: 12,
  padding: 16,
  backgroundColor: '#27272a',
}

const savedWorkoutCardStyle: React.CSSProperties = {
  border: '1px solid #52525b',
  borderRadius: 12,
  padding: 16,
  backgroundColor: '#27272a',
}

const exercisePreviewStyle: React.CSSProperties = {
  border: '1px solid #3f3f46',
  borderRadius: 10,
  padding: 12,
  backgroundColor: '#18181b',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  color: '#d4d4d8',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 12,
  borderRadius: 10,
  border: '1px solid #52525b',
  backgroundColor: '#27272a',
  color: '#ffffff',
}

const buttonStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 10,
  border: '1px solid #52525b',
  backgroundColor: '#27272a',
  color: '#ffffff',
  cursor: 'pointer',
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 10,
  border: '1px solid #52525b',
  backgroundColor: '#18181b',
  color: '#ffffff',
  cursor: 'pointer',
}

const deleteButtonStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 10,
  border: '1px solid #991b1b',
  backgroundColor: '#991b1b',
  color: '#ffffff',
  cursor: 'pointer',
}

const smallDeleteButtonStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #991b1b',
  backgroundColor: '#991b1b',
  color: '#ffffff',
  cursor: 'pointer',
}