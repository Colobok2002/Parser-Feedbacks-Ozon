import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

// Define the CounterState interface
export interface CounterState {
  feedback: number;
  timer: number;
  interval: number;
  work: boolean;
}

// Define the initial state
const time = 60;
const initialState: CounterState = {
  feedback: 0,
  timer: time,
  interval: time,
  work: false,
};

// Create a slice for feedback
const feedbackSlice = createSlice({
  name: "feedback",
  initialState,
  reducers: {
    setFeedback: (state, action: PayloadAction<number>) => {
      state.feedback = action.payload;
    },
    setTimer: (state, action: PayloadAction<number>) => {
      state.timer = action.payload;
    },
    setInterval: (state, action: PayloadAction<number>) => {
      state.interval = action.payload;
    },
    setWork: (state, action: PayloadAction<boolean>) => {
      state.work = action.payload;
    },
  },
});

// Export actions and reducer
export const { setFeedback, setTimer, setInterval, setWork } = feedbackSlice.actions;
export default feedbackSlice.reducer;
