// feedbackSlice.js
import { createSlice } from "@reduxjs/toolkit";

export interface CounterState {
  feedback: [],
  timer: number,
  interval: number
}

const time = 30
const initialState: CounterState = {
  feedback: [],
  timer:  time,
  interval:  time
}

const feedbackSlice = createSlice({
  name: "feedback",
  initialState,
  reducers: {
    setFeedback: (state, action) => {
      state.feedback = action.payload;
    },
    setTimer: (state, action) => {
      state.timer = action.payload;
    },
    setInterval: (state, action) => {
      state.interval = action.payload;
    }
  }
})

export const { setFeedback, setTimer, setInterval } = feedbackSlice.actions;

export default feedbackSlice.reducer;
