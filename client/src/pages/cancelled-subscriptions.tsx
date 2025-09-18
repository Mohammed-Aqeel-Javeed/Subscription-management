import React from 'react';
import Subscriptions from './subscriptions';

// Wrapper page that forces cancelled status filter via location state or global event
export default function CancelledSubscriptionsPage() {
  // We simply render the subscriptions page but rely on query parameters / location state in future
  // For now, reuse component and filter in component if pathname matches
  return <Subscriptions />;
}
