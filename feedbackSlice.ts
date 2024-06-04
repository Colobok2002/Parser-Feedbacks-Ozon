import { createSlice } from "@reduxjs/toolkit"

export interface CounterState {
  feedback: []
}

const feedbackSlice = createSlice({
  name: "feedback",
  initialState: { feedback: [], timer: 10, interval: 10 },
  reducers: {
    setFeedback: (state) => {
      state.feedback = state.feedback
    },
    setTimer: (state) => {
      state.timer = state.timer
    },
    setInterval: (state) => {
      state.interval = state.interval
    }
  }
})

export const { setFeedback, setTimer, setInterval } = feedbackSlice.actions

export default feedbackSlice.reducer