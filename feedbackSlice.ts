import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface CounterState {
  feedback: number;
  timer: number;
  interval: number;
  work: boolean;
}

const time = 60 * 10

const initialState: CounterState = {
  feedback: 0,
  timer: time,
  interval: time,
  work: false,
};

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

export const { setFeedback, setTimer, setInterval, setWork } = feedbackSlice.actions;
export default feedbackSlice.reducer;
