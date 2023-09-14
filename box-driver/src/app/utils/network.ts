const DEAD_TIME = 5;
const LIVE_TIME = 10;
let isDead = false;
let count = 0;

export const hasNetworkConnection = () => {
  if (process.env.FLAG_SIMULATE_DEAD === 'true') {
    count++;
    if (!isDead) {
      if (count > LIVE_TIME) {
        isDead = true;
        count = 0;
      }
    } else {
      if (count > DEAD_TIME) {
        isDead = false;
        count = 0;
      }
    }
    console.log({ count, isDead });
    return !isDead;
  }

  return true;
};
