export function evaluationOrder(outbound: string) {
  return [
    "tailnet-domain," + outbound,
    "tailnet-ipcidr," + outbound + ",no-resolve",
    "custom-proxy-domain,default",
    "custom-proxy-classical,default",
    "custom-direct-domain,DIRECT",
    "custom-direct-classical,DIRECT",
    "direct-domain,DIRECT",
    "direct-classical,DIRECT",
    "global-domain,default",
    "global-classical,default",
    "global-ipcidr,default,no-resolve",
    "direct-ipcidr,DIRECT",
    "MATCH,default",
  ];
}
