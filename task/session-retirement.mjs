// Deleted sessions must not be treated as transient offline failures.
export function createSessionRetirement(onRetire){let retired=false;return {get retired(){return retired;},handle(error){if(retired)return true;if(![404,410].includes(error?.status))return false;retired=true;onRetire(error);return true;}};}
