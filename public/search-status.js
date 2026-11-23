export function isCompleteSearch(results) {
  return results?.complete === true && results.stopReason === 'end_of_list' && results.cappedAt === null;
}

export function partialSearchMessage(searches) {
  if (!searches.length) return '';
  const reasons = searches.map(({ name, stopReason, cappedAt }) => {
    const reason = stopReason === 'max_items' ? `reached the ${cappedAt.toLocaleString()}-notice limit`
      : stopReason === 'run_timeout' ? 'stopped before all notices were checked'
      : stopReason === 'failed' ? 'could not be loaded'
      : 'could not confirm that all notices were checked';
    return `${name}: ${reason}.`;
  });
  return `Partial results. ${reasons.join(' ')} Counts cover loaded notices only; more matches may exist. Narrow the search filters or refresh results to try again.`;
}
