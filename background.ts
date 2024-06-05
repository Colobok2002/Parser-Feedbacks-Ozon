import axios from "axios";
import { persistor, store } from '~store';
import { setFeedback, setTimer } from '~feedbackSlice';

let interval_time: number;


const checkAllProcessed = (data) => {
  return data.every(item => item.interaction_status === 'PROCESSED');
};

const getCookies = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    chrome.cookies.getAll({}, (cookies) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        resolve(cookieString);
      }
    });
  });
};


const getFeedback = async () => {
  try {
    const cookies = await getCookies();
    let allProcessed = false;
    let pagination_last_timestamp = null;
    let pagination_last_uuid = null;
    let allReviews = [];
    let unprocessedReviews = [];

    while (!allProcessed) {
      const response = await fetch("https://seller.ozon.ru/api/v3/review/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": cookies
        },
        body: JSON.stringify({
          "with_counters": false,
          "sort": { "sort_by": "PUBLISHED_AT", "sort_direction": "DESC" },
          "company_type": "seller",
          "filter": { "interaction_status": ["ALL"] },
          "company_id": "27844",
          "pagination_last_timestamp": pagination_last_timestamp,
          "pagination_last_uuid": pagination_last_uuid
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      allReviews = [...allReviews, ...data.result];

      const newUnprocessed = data.result.filter(item => item.interaction_status !== 'PROCESSED');
      unprocessedReviews = [...unprocessedReviews, ...newUnprocessed];

      if (checkAllProcessed(data.result)) {
        allProcessed = true;
      } else {
        pagination_last_timestamp = data.pagination_last_timestamp;
        pagination_last_uuid = data.pagination_last_uuid;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    store.dispatch(setFeedback(unprocessedReviews));
  } catch (error) {
    console.error(error);
  }
};

const ansverRiviev = async (review_uuid: string, text: string) => {
  const data = {
    "review_uuid": review_uuid,
    "text": text,
    "company_type": "seller",
    "company_id": "27844"
  }
  try {
    const cookies = await getCookies();
    fetch("https://seller.ozon.ru/api/review/comment/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": cookies
      },
      body: JSON.stringify(data)
    })
      .then(response => {
        if (!response.ok) {
          alert(response.status);
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        alert("Ответ отправлен успешно!");
      })
      .catch(error => console.log(error));
  } catch (error) {
    console.log(error);
  }
}

const startIntervals = () => {
  const state = store.getState();
  interval_time = state.feedback.interval;
  store.dispatch(setFeedback([]));
  setInterval(() => {
    const state = store.getState();
    let work = state.feedback.work
    if (work) {
      console.log("work")
      const newTimer = state.feedback.timer > 1 ? state.feedback.timer - 1 : interval_time;
      store.dispatch(setTimer(newTimer));
      if (state.feedback.timer == 1 || state.feedback.timer == interval_time) {
        getFeedback()
      }
    } else {
      store.dispatch(setTimer(interval_time));
      console.log("no work")
    }
  }, 900);
};

startIntervals();

