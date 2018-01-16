
console.log("worker #1 start");


// let c= 0;
// let t1 = setInterval(function(){
// 	c+=1;
// 	//console.log(c);
// },1000);


var i = 0;

function timedCount() {
	console.log("w",i);
	i = i + 1;
	postMessage(i);
	if (i<10) {
		setTimeout("timedCount()", 500);
	}
}

timedCount();
