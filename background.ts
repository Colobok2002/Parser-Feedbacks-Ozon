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

const sendItem = async (review) => {
  if (review.interaction_status !== "PROCESSED") {
    const data = {
      "prod_art": review.product.offer_id,
      "prod_name": review.product.title,
      "feedback_ID": review.uuid,
      "rating": review.rating,
      "positive": review.text.positive,
      "negative": review.text.negative,
      "comment": review.text.comment,
      "market": "ozon",
      "dateTimeFeedback": review.published_at
    }

    await axios.post("http://127.0.0.1:8001/feedbacks/add-feedbacks/", data).catch(err => { console.log(err.response.data) })
  }
}

const getFeedback = async () => {
  try {
    const cookies = await getCookies();
    let pagination_last_timestamp = null;
    let pagination_last_uuid = null;
    let allReviews = [];
    let unprocessedReviews = [];

    while (true) {
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
          "filter": { "interaction_status": ["NOT_VIEWED"] },
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

      pagination_last_timestamp = data.pagination_last_timestamp;
      pagination_last_uuid = data.pagination_last_uuid;

      if (!pagination_last_timestamp || !pagination_last_uuid) {
        break;
      }
    }

    while (true) {
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
          "filter": { "interaction_status": ["VIEWED"] },
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

      pagination_last_timestamp = data.pagination_last_timestamp;
      pagination_last_uuid = data.pagination_last_uuid;

      if (!pagination_last_timestamp || !pagination_last_uuid) {
        break;
      }
    }

    store.dispatch(setFeedback(unprocessedReviews.length));
    unprocessedReviews.forEach((review) => {
      sendItem(review);
    });
    
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

const startIntervals = async () => {
  const state = store.getState();
  interval_time = state.feedback.interval;
  const work = state.feedback.work
  if (work) {
    await getFeedback()
  }
  setInterval(async () => {
    const state = store.getState();
    const work = state.feedback.work
    console.log(work)
    if (work) {
      const newTimer = state.feedback.timer > 1 ? state.feedback.timer - 1 : interval_time;
      store.dispatch(setTimer(newTimer));
      if (newTimer === 1) {
        await getFeedback()
      }
    } else {
      store.dispatch(setTimer(interval_time));
    }
  }, 900);
};

startIntervals();
