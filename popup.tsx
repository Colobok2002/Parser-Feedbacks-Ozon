import axios from "axios";
import React, { useEffect, useState } from "react";
import { Provider } from "react-redux"
import { PersistGate } from "@plasmohq/redux-persist/integration/react"
import { persistor, store } from "~store"

const RenderItem = ({ review, replyText, setReplyText, ansverRiviev }) => {
  return (
    <div key={review.uuid} style={{ border: "1px solid black", padding: "10px", margin: "10px" }}>
      <p>Product : {review.product.title}</p>
      <p>ProductId : {review.product.offer_id}</p>
      <p>UUID: {review.uuid}</p>
      <p>Rating: {review.rating}</p>
      <p>Positive: {review.text.positive}</p>
      <p>Negative: {review.text.negative}</p>
      <p>Comment: {review.text.comment}</p>
      <textarea
        value={replyText[review.uuid] || ""}
        onChange={(e) => setReplyText({ ...replyText, [review.uuid]: e.target.value })}
      />
      <button onClick={() => ansverRiviev(review.uuid, replyText[review.uuid] || "")}>Ответить</button>
    </div>
  )
}

const Popup = () => {
  const timer_count = 10
  const [url, setUrl] = useState("");
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);
  const [replyText, setReplyText] = useState({});
  const [timer, setTimer] = useState(timer_count);

  useEffect(() => {
    const queryInfo = { active: true, currentWindow: true };

    chrome.tabs.query(queryInfo, (tabs) => {
      const tab = tabs[0];
      setUrl(tab.url);
    });

    getFeedback();
    const interval = setInterval(() => {
      getFeedback();
    }, timer_count * 1000);

    const timerInterval = setInterval(() => {
      setTimer(prev => prev > 0 ? prev - 1 : timer_count);
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(timerInterval);
    };
  }, []);

  useEffect(() => {
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

        await axios.post("http://127.0.0.1:8001/feedbacks/add-feedbacks/", data)
      }
    }
    data.map((review) => {
      sendItem(review)
    })
  }, [data]);

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

  const checkAllProcessed = (data) => {
    return data.every(item => item.interaction_status === 'PROCESSED');
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
          alert(response.status);
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

      setData(unprocessedReviews);
    } catch (error) {
      alert(error);
      setError(error);
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
          console.log(data);
          alert("Ответ отправлен успешно!");
        })
        .catch(error => setError(error));
    } catch (error) {
      alert(error);
      setError(error);
    }
  }

  const handleRedirect = () => {
    chrome.tabs.create({ url: "https://seller.ozon.ru/app" });
  };

  if (url.includes("https://seller.ozon.ru/app")) {
    return (
      <div>
        <p>Следующее обновление через: {timer} секунд</p>
        {data && data.map(review => (
          <RenderItem
            key={review.uuid}
            review={review}
            replyText={replyText}
            setReplyText={setReplyText}
            ansverRiviev={ansverRiviev}
          />
        ))}
        {error && <p>Ошибка: {error.message}</p>}
      </div>
    );
  }

  return (
    <div>
      <p>Данный плагин работает только на <span onClick={handleRedirect} style={{ color: 'blue', cursor: 'pointer' }}>этой странице</span>.</p>
      {error && <p>Ошибка: {error.message}</p>}
    </div>
  );
};





function IndexPopup() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <Popup></Popup>
      </PersistGate>
    </Provider>
  )
}

export default IndexPopup