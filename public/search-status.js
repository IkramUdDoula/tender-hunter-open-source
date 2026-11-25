export function isCompleteSearch(results) {
  return results?.complete === true && results.stopReason === 'end_of_list' && results.cappedAt === null;
}

export function partialSearchMessage(searches, noun = 'notice') {
  if (!searches.length) return '';
  const reasons = searches.map(({ name, stopReason, cappedAt }) => {
    const reason = stopReason === 'max_items' ? `reached the ${cappedAt.toLocaleString()}-${noun} limit`
      : stopReason === 'run_timeout' ? `stopped before all ${noun}s were checked`
      : stopReason === 'failed' ? 'could not be loaded'
      : `could not confirm that all ${noun}s were checked`;
    return `${name}: ${reason}.`;
  });
  return `Partial results. ${reasons.join(' ')} Counts cover loaded ${noun}s only; more matches may exist. Narrow the search filters or refresh results to try again.`;
}
