//@charset "utf-8";
/* ========================================

  @author : Atsushi Nagase

  Copyright 2008 Atsushi Nagase All rights reserved.
  http://ngsdev.org/

======================================== */

var ASSETS_PATH = "http://abroad-ig.googlecode.com/svn/trunk/www/assets/";
var API_KEY = "b0b3029cd492f70f";
Recruit.UI.key = API_KEY;
var MODULE_ID;
var TABNAMES,
    DIV_IDS = ["form","results","starred"],
    DES_KEYS = ["area","country","city"];
var prefs, tabs;

var NOIMAGE_GIF = ASSETS_PATH+"img/noimage.gif";
var MAX_TITLE_LENGTH = 30;
var MAX_POINT_LENGTH = 50;

function getRandomQuery() { return "rnd="+Math.ceil(Math.random()*10000000).toString(); }
function serializeQuery(obj) {
	var ret = "";
	$.each(obj,function(i){ ret+=i+"="+this+"&"; });
	return ret;
}

var ABROAD_IG = {
	init : function(mid) {
		MODULE_ID = mid;
		prefs = new gadgets.Prefs(MODULE_ID);
		TABNAMES = [
			prefs.getMsg("search")||"search",
			prefs.getMsg("result")||"result",
			prefs.getMsg("starred")||"starred"
		];
		CALLBACKS = [showForm,showResult,showStarred];
		tabs = new gadgets.TabSet(MODULE_ID,TABNAMES[prefs.getInt("tab")||0]);
		$.each(TABNAMES,function(i){ tabs.addTab(this,DIV_IDS[i],CALLBACKS[i]); });
		var forminit = false, tabindex, content;
		var resultsinit = false, starredinit = false;
		function showForm() {
			handleSwapTab();
			if(forminit) return;
			forminit = true;
			new ABROAD.UI.Places.Pulldown({
				area    : {
					first_opt_text  : prefs.getMsg("select_area"),
					with_tour_count : true,
					on_update_hook  : setValueToPref,
					val             : prefs.getString("area") || ""
				},
				country : {
					first_opt_text  : prefs.getMsg("select_country"),
					with_tour_count : true,
					on_update_hook  : setValueToPref,
					val             : prefs.getString("country") || ""
				},
				city    : {
					first_opt_text  : prefs.getMsg("select_city"),
					with_tour_count : true,
					on_update_hook  : setValueToPref,
					val             : prefs.getString("city") || ""
				}
			});
			$("#search-form").bind("submit", function(){
				resultsinit = false;
				tabs.setSelectedTab(1);
				return false;
			});
		}
		function setValueToPref() {
			$("fieldset#dest select").each(function(){
				prefs.set($(this).attr("name"),$(this).val())
			})
		}
		function showResult() {
			handleSwapTab();
			if(!resultsinit) getResults();
		}
		function showStarred() {
			handleSwapTab();
			if(!starredinit) getResults();
		}
		function getResults() {
			var driver =  new Recruit.UI.Driver.JSONP({
				url   : "/ab-road/tour/v1/alliance",
				disable_cache : true,
				prm : { type : "lite" }
			});
			var prm = {}, err, ele = $("#"+DIV_IDS[tabindex]);
			switch(tabindex) {
				case 1:
					$("#search-form").serializeArray().each(function(i){
						prm[i.name] = prm[i.name]||[];
						prm[i.name].push(i.value);
					});
					$.each(prm,function(i){ prm[i] = this.join(); })
					prm.count = prefs.getInt("count") || 20;
					resultsinit = true;
					break;
				case 2:
					var ar = getStarred();
					if(!ar.length) return showNotice("nostarred");
					prm.id = ar.join();
					prm.count = 100;
					starrediniit = true;
					break;
				default:
					return;
			}
			content.html("<div class=\"loading\"><p>"+prefs.getMsg("loading")+"<\/p><\/div>");
			driver.get(appendResults,prm);
		}
		function appendResults(s,d,h) {
			console.log(s,d,h);
			var res = d&&d.results?d.results:{};
			var err = res.error&&res.error[0]&&res.error[0].message?res.error[0].message:"fetch_error";
			if(!s) return showNotice(err);
			var tours = res.tour;
			if(!tours||!tours.length) return showNotice("notours");
			var ht = [
			"<div class=\"header\">",
				"<p id=\"hitnum\">",
					"<em class=\"int\">",res.results_available,"<\/em>",
					"<span class=\"unit\">",prefs.getMsg("tours_available"),"<\/span>",
				"<\/p>",
			"<\/div>",
			"<div class=\"body\"><form class=\"checkbox-wrapper\">",
				"<ul class=\"tours\">"
			];
			var id_prefix = tabindex == 1 ? "res":"star";
			$.each(tours,function(i){
				var img = (this.img[0]||{}).s || NOIMAGE_GIF;
				var alt = (this.img[0]||{}).caption || "&nbsp;";
				var ttl = this.title || "";
				if(ttl.length>MAX_TITLE_LENGTH) ttl = ttl.substr(0,MAX_TITLE_LENGTH)+"...";
				var pt = (this.tour_point||"").replace(/<BR>|\n|\s|\t/ig," ");
				if(pt.length>MAX_POINT_LENGTH) pt = pt.substr(0,MAX_POINT_LENGTH)+"..."; 
				var atag_s = "<a href=\""+ this.urls.pc +"\" title="+ ttl +" target=\"_blank\">";
				var atag_e = "<\/a>";
				var id = this.id;
				var starred = isStarred(id);
				var starred_msg = prefs.getMsg(starred?"remove_star":"add_star");
				ht.push([
					"<li class=\"tour ",id," ",i%2?"odd":"even",starred?" starred":"","\" id=\"",id_prefix,"-",id,"\">",
						"<div class=\"text\">",
							"<h3>",atag_s,ttl,atag_e,"<\/h3>",
							"<blockquote class=\"point\"><p>",pt,"<\/p><\/blockquote>",
							"<p class=\"star\">",
								"<span class=\"link\" onclick=\"ABROAD_IG.toggleStar('",id,"')\" title=\"",starred_msg ,"\">", starred_msg, "<\/span>",
							"<\/p>",
						"<\/div>",
						"<p class=\"pict\">",atag_s,"<img src=\"",img,"\" alt=\"",alt,"\" \/>",atag_e,"<\/p>",
					"<\/li>"
				].join(""));
			});
			ht.push("<\/ul><\/form><\/div>");
			content.html(ht.join(""));
		}
		function showNotice(msgkey) {
			handleSwapTab();
			content.html("<p class=\"notice\">"+(prefs.getMsg(msgkey)||msgkey||prefs.getMsg("unknown_error"))+"<\/p>");
		}
		function handleSwapTab() {
			tabindex = tabs.getSelectedTab().getIndex();
			content = $("#"+DIV_IDS[tabindex]);
			return content;
		}
		//
		// star
		//
		function addStar(id) {
			var ar = getStarred();
			if(!isStarred(id)) ar.push(id);
			$("ul.tours li."+id).addClass("starred");
			var msg = prefs.getMsg("remove_star");
			$("ul.tours li."+id+" p.star span").html(msg).attr("title",msg);
			handleStarChange(ar,id);
		}
		function removeStar(id) {
			var ar = getStarred();
			ar = $.grep(ar,function(n,i){ return n != id; })
			$("#star-"+id).remove();
			$("ul.tours li."+id).removeClass("starred");
			var msg = prefs.getMsg("add_star");
			$("ul.tours li."+id+" p.star span").html(msg).attr("title",msg);
			handleStarChange(ar,id);
		}
		function handleStarChange(ar,id) {
			prefs.set("starred",getStarred(ar).join());
			if(tabindex==2) {
				if(!ar.length) showNotice("nostarred");
				else {
					$("#"+DIV_IDS[2]+" ul.tours li").each(function(i){
						$(this).removeClass(!i%2?"odd":"even");
						$(this).addClass(i%2?"odd":"even");
					});
				}
			} else starredinit = false;
		}
		function getStarred(ar) {
			ar = ar || (prefs.getString("starred") || "").split(",");
			ar = $.grep(ar,function(n,i){ return typeof(n)=="string"&&n.length==8; })
			while(ar.length>20) ar.pop();
			return ar;
		}
		function isStarred(id)  { return $.inArray(id,getStarred())!=-1; }
		function toggleStar(id) { return (isStarred(id)?removeStar:addStar)(id); }
		this.toggleStar = toggleStar;
	}
}
