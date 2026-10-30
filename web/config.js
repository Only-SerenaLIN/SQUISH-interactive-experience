export const CONFIG=Object.freeze({
  world:{width:1200,height:2400},
  economy:{startingGlow:35,reproductionCost:50,baseGlowPerJelly:1,shellCost:30,shellBonus:1,slideCost:150,slideBonus:2,offlineCapSeconds:14400},
  species:{
    blue:{label:'蓝水母',personality:'沉静',color:'#9ecbff',accent:'#c8f2ff',speed:22,glow:1,habitat:'shell'},
    pink:{label:'粉水母',personality:'害羞',color:'#ffafd3',accent:'#ffe0ee',speed:31,glow:1.12,habitat:'shell'},
    yellow:{label:'金水母',personality:'活泼',color:'#ffd77f',accent:'#fff0b8',speed:39,glow:1.28,habitat:'slide'}
  },
  habitats:{shell:{label:'贝壳休息台',x:430,y:820,cost:30,bonus:1},slide:{label:'水母滑梯',x:770,y:820,cost:150,bonus:2}}
});
