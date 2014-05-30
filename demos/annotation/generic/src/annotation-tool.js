function Annotator(options) {

    var _options = {
        url:"https://api.redlink.io",
        version: "1.0-BETA",
        analysis: "demo",
        key: "4yS6IbNzDTGROHR0RyGMODHT6P1AP6eU8144eb96",
        container:"#annotator",
        template:"template/template.html",
        confidence:80,
        buttonTexts:{
            annotate:"Annotate",
            edit:"Edit Text"
        },
        feedback:true,
        spinner:"img/ajax-loader.gif",
        text:'\n<div class="post-top clearfix">\n<h2><a href="http://redlink.co/democratising-semantic-technologies/">Democratising Semantic Technologies</a></h2>\n</div>\n<div class="post-content"><img class="alignleft responsive-image" alt="Photo" src="http://farm4.staticflickr.com/3707/9299267555_8efc33b8f7_m.jpg" /> This may seem like a strange title for a first blog by a first time managing director (John Pereira) of a startup. But it seems apt to describe the spirit behind Redlink. (Redlink is located in the beautiful city of Salzburg, famous for Wolfgang Amadeus Mozart, picturesque landscape, Alpine skiing and of course the Red Bull company).&nbsp;</p>\n<p>With our DNA firmly anchored in the world of semantic technologies and linked data (research and software development) we became over the last few years increasingly frustrated by the lack of friendly open source software supporting the wider adoption of semantic technologies. So towards the end of 2012, the mildly disgruntled researchers amongst us equipped with our latest software goodies went in search of street smart business partners to change this.</p>\n<p>In our bag of goodies was Apache Stanbol and Apache Marmotta (in incubation) as core pillars of our solution. Both the result of many years of research (more of this in a future post). One of the research projects, Interactive Knowledge Stack (IKS), was especially critical in exposing us to the right business network. My role in the IKS project was building the business and development community around the software projects. This proved an excellent opportunity to gauge the commercial potential (through IKS early adopters programme) of our software and eventually put me in contact with a great bunch of people. Aingaran Pillai CEO of Zaizi and Andrea Volpini CEO of InsideOut10 were so convinced by the software that we soon moved onto the planning of what would eventually become Redlink GmbH.</p>\n</div>\n',
        empty_description:"no description"
    }
    jQuery.extend(_options,options);

    var _annotations = [];
    var _text = "";
    var _lang = "";

    var _lang_mapper = {
        de : "Deutsch",
        en : "English",
        es : "Español",
        it : "Italiano",
        fr : "Français"
    }

    /******** FEEDBACK THINGS ***********/
    var _feedback = (function($) {
        var fb = {
            logViewEdit: function() {},
            logAnnotate: function() {},
            logViewAnnotationList: function() {},
            logViewAnnotation: function() {}
        };
        if (_options.feedback && window.Piwik && window.Piwik.getTracker) {
            var defaultText = _options.text;
            var t = window.Piwik.getTracker("http://analytics.redlink.co/piwik.php", 3);
            // basic setup
            t.setCookieNamePrefix("_ator_");
            // t.setCookieDomain("");
            t.setReferrerUrl(window.location.href);
            t.setCustomVariable(1, "server", _options.url, "visit");
            t.setCustomVariable(2, "installType", "debug", "visit");
            
            function logView(lName, title) {
                t.setCustomUrl("http://demo.api.redlink.io/annotator/" + lName);
                t.setCustomVariable(1, "language", _lang, "page");
                t.trackPageView(title || lName);
            }
            fb.logViewEdit = function() {
                logView("edit");
            };
            fb.logAnnotate = function(duration) {
                var rev = "1";
                if (_text != defaultText) rev = "1.25";
                t.trackGoal(1, rev);
                this.logViewAnnotationList();
            };
            fb.logViewAnnotationList = function() {
                logView("annotations");
            };
            fb.logViewAnnotation = function(a) {
                logView("a?uri="+encodeURIComponent(a.uri), "a/"+a.type+"/"+a.name);
            };
            logView("start");
        }
        return fb;
    })(jQuery);

    /******** ANNOTATION THINGS *********/

    function typeMapper(type) {
        //TODO: extend
        if (jQuery.inArray("http://dbpedia.org/ontology/Place", type) >= 0) return "rle_location";
        if (jQuery.inArray("http://dbpedia.org/ontology/Place", type) >= 0) return "rle_location";
        if (jQuery.inArray("http://dbpedia.org/ontology/Person", type) >= 0) return "rle_person";
        if (jQuery.inArray("http://www.w3.org/2004/02/skos/core#Concept", type) >= 0) return "rle_concept";
        return "rle_other";
    }

    function hash(s){
        var hash = 0, i, char;
        if (s.length == 0) return hash;
        for (i = 0, l = s.length; i < l; i++) {
            char  = s.charCodeAt(i);
            hash  = ((hash<<5)-hash)+char;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    };

    function Annotation(uri, name, confidence, type) {
        this.uri = uri;
        this.name = name;
        this.confidence = confidence;
        this.positions = [];
        this.type = typeMapper(type, uri);
        this.desc = "";
        this.thumb = undefined;
    }

    function cleanData(data) {

        _lang = data.languages[0];
        //console.log("language: " + _lang)
        _annotations = [];
        if(data.length == 0) return;
        for(var i=0; i<data.annotations.length; i++) {
            var uri = data.annotations[i].reference;
            //console.log("uri: " + uri);

            var annotation = new Annotation(uri, data.annotations[i].label, 1, data.annotations[i].types);
            var confidence = 1;
            for(var j = 0; j < data.annotations[i].positions.length; j++) {
                var start = parseInt(data.annotations[i].positions[j].position.start);
                var end = parseInt(data.annotations[i].positions[j].position.end);
                annotation.positions.push({start:start, end:end, length:end-start});
                if(data.annotations[i].positions[j].confidence < confidence) confidence = data.annotations[i].positions[j].confidence;
            }

            /*
            if (data.annotations[i].summaries.length > 0) {
                annotation.desc = data.annotations[i].summaries[0].text;
                for (var j=0; j<data.annotations[i].summaries.length; j++) {
                    if (data.annotations[i].summaries[j].language == _lang) {
                        annotation.desc = data.annotations[i].summaries[j].text;
                        break;
                    }
                }
            }
            */

            for (var j=0; j<data.annotations[i].entity.properties.length; j++) {
                var p = data.annotations[i].entity.properties[j];
                switch(p.predicate) {
                    case "http://dbpedia.org/ontology/thumbnail":
                        if(annotation.thumb == undefined) annotation.thumb = p.values[0];break;
                    case "http://rdf.freebase.com/ns/common.topic.image":
                        var id = p.values[0].substring(p.values[0].lastIndexOf("/")+1).replace(/\./g,"/");
                        if(annotation.thumb == undefined) annotation.thumb = "https://usercontent.googleapis.com/freebase/v1/image/" + id;
                        break;
                    case "http://www.w3.org/2000/01/rdf-schema#comment":
                    case "http://www.w3.org/2004/02/skos/core#definition":
                    case "http://rdf.freebase.com/ns/common.topic.description":
                        for(var k in p.values) {
                            annotation["desc_"+ p.values[k].language] = p.values[k].value;
                        }
                        break;
                }
            }

            if(annotation["desc_"+_lang] != undefined) annotation.desc = annotation["desc_"+_lang];
            else if(annotation["desc_en"] != undefined) annotation.desc = annotation["desc_en"];

            annotation.confidence = data.annotations[i].confidence;
            if(annotation.thumb == undefined) annotation.thumb = data.annotations[i].thumbnail ? data.annotations[i].thumbnail : undefined;

            _annotations.push(annotation);

        };
        //console.log(_annotations);

        function sortValue(uri) {
            if(/^http:\/\/demo.api.redlink.io/.test(uri)) return 100;
            if(/^http:\/\/rdf.freebase.com/.test(uri)) return 20;
            if(/^http:\/\/dbpedia.org/.test(uri)) return 10;
            return 0;
        }

        //order on confidence and type
        _annotations.sort(function(a,b){
            if(a.confidence == b.confidence) {
                if(sortValue(a.uri) < sortValue(b.uri)) return 1;
                return -1;
            } else if(a.confidence < b.confidence) return 1;
            return -1;
        })

        _annotations.sort(function(a,b){
            if(a.confidence == b.confidence) {
                var v_a = sortValue(a.uri);
                var v_b = sortValue(b.uri)
                if(v_a < v_b) return 1;
                if(v_a > v_b) return -1;
                if(a.name > b.name) return 1;
                return -1;
            } else if(a.confidence < b.confidence) return 1;
            return -1;
        })

        function contains(a_list, a) {
            for(var i in a_list) {
                if(a_list[i].name.toUpperCase() == a.name.toUpperCase() ) return true;
            } return false;
        }

        //remove duplicates
        var a = []
        for(var i in _annotations) {
            if(!contains(a,_annotations[i])) a.push(_annotations[i]);
        }
        _annotations = a;
    }

    function showList() {
        jQuery("#rle_right_inner").animate({marginLeft:"0"},200);
        _feedback.logViewAnnotationList();
    }

    function showSingle(annotation) {
        var desc = annotation.desc=="" ? _options.empty_description : annotation.desc;

        var thumb = annotation.thumb != undefined ? "<img style='width:80px;' class='rle_single_desc_img' src='"+annotation.thumb+"'>" : "";
        jQuery("#rle_right_inner_right").removeClass();
        var div = jQuery("<div class='rle_single_desc_div'></div>").append(
            "<span class='rle_list_title'>"+annotation.name+"</span>"+
            "<span class='rle_list_confidence'>"+Math.round(annotation.confidence*100)+"%</span><br>" +
            "<span class='rle_single_url'>"+annotation.uri+"</span>" +
            "<div class='rle_single_desc_outer'>"+thumb+"<p class='rle_single_desc'>"+desc+"</p></div>"
        )
        jQuery("#rle_right_inner_right").empty().addClass(annotation.type).append(div).click(function(){
            showList();
        });
        if(jQuery("#rle_right_inner").css("margin-left") != "-300px"){
            jQuery("#rle_right_inner").animate({marginLeft:"-300px"},200)
        }
        _feedback.logViewAnnotation(annotation);
    }

    //TODO debug
    jQuery("#rle_annotation").click(function(){
        showList();
    });

    function highlightText(annotations) {

        function onClick(annotation) {
            return function() {
                showSingle(annotation);
            }
        }

        //set start, end and link
        var pos = [];
        for(var i in annotations) {
            for(var j in annotations[i].positions) {
                var position = annotations[i].positions[j];
                if(position.enabled) {
                    pos[position.start] = {a:annotations[i],p:position};
                }
            }
        }
        var text = jQuery("<div></div>");
        var cache = "";
        for(var i=0; i<_text.length; i++) {
            if(pos[i] != undefined) {

                if(cache != "") {
                    text.append(cache);
                    cache = "";
                }

                var t = "";
                for(var j=0; j<pos[i].p.length;j++) {
                    t += _text[i+j];
                }
                var x = jQuery("<span></span>").addClass("key_"+hash(pos[i].a.uri)).addClass("textmarker").addClass(pos[i].a.type).text(t).click(onClick(pos[i].a));
                text.append(x);
                i += (pos[i].p.length-1);
            } else {
                cache += _text[i];
            }
        }
        if(cache != "") text.append(cache);
        jQuery("#rle_annotation").empty().html(text);
    }

    function showLanguage() {
        if(_lang != "") {
            jQuery("#rle_language").empty().append(
                _lang_mapper[_lang] != undefined ? jQuery("<span></span>").text("Language: "+_lang_mapper[_lang]) :  jQuery("<span></span>").text("Language: "+_lang)
            )
        }
    }

    function showAnnotations() {

        showLanguage();

        jQuery("#rle_right_inner_left_inner").css("marginTop","0");

        var annotations = [];
        var confidence = jQuery("#rle_slider").slider("value")/100;

        var limit = 8;
        var offset = 0;

        var marginTopGap = 416;
        var currentOffset = offset;

        for(var j=0; j<_annotations.length; j++) {
            if(_annotations[j].confidence >= confidence) annotations.push(_annotations[j]);
        }

        //clean annotations based on text position
        var textposition = [];

        function pushToText(annotation,position) {
            for(var i=position.start; i<position.start+position.length;i++) {
                if(textposition[i] == undefined) textposition[i] = [];
                textposition[i].push({a:annotation,p:position});
            }
        }

        var a = [];
        for(var i in annotations) {
           annotations[i].enabled = false;
           for(var j in annotations[i].positions) {
                pushToText(annotations[i],annotations[i].positions[j]);
           }
        }

        //for all textpositions enable, disable
        for(var i=0; i<textposition.length;i++) {
            if(textposition[i] == undefined) continue;

            var enable = undefined;
            for(var j=0; j<textposition[i].length;j++) {
                if(enable==undefined) enable = textposition[i][j];
                else if(enable.p.length < textposition[i][j].p.length) {
                    enable = textposition[i][j];
                }
            }
            enable.a.enabled=true;
            enable.p.enabled=true;
        }

        for(var i in annotations) {
            if(annotations[i].enabled) a.push(annotations[i]);
        }

        annotations = a;

        function showAnnotation(i) {
            if(annotations.length > i) {
                var a = annotations[i];

                var div = jQuery("<div></div>").addClass("rle_annotation").addClass(annotations[i].type).html(
                        "<span class='rle_list_title'>"+annotations[i].name+"</span>"+
                        "<span class='rle_list_confidence'>"+Math.round(annotations[i].confidence*100)+"%</span>"
                    )
                    .click(function(){
                        showSingle(a);
                        jQuery("#rle_annotation").animate({
                            scrollTop: parseInt(jQuery(".key_"+hash(a.uri)).offset().top)+jQuery("#rle_annotation").scrollTop()-100-parseInt(jQuery("#rle_annotation").offset().top)
                        }, 400,function(){
                            var color = jQuery(".key_"+hash(a.uri)).css("color");
                            jQuery(".key_"+hash(a.uri)).animate({backgroundColor:color,color:"lightgrey"},800,"swing",function(){
                                jQuery(".key_"+hash(a.uri)).animate({backgroundColor:"transparent",color:color},800,"swing");
                            });
                        });
                    })
                    .appendTo("#rle_right_inner_left_inner");
                div.fadeIn(Math.round(200/annotations.length),function(){
                    showAnnotation(++i);
                })
            } else {
                jQuery("#rle_button_edit").show();
                jQuery("#rle_buttons").show();
            }
            if(i>limit+offset) {
                jQuery("#rle_more_or_less").show();
            }
        }

        /*
        function prev() {
            var marginTop = Math.min(0,parseInt(jQuery("#rle_right_inner_left_inner").css("marginTop")) + marginTopGap);
            currentOffset = currentOffset-limit;
            jQuery("#rle_right_inner_left_inner").animate({marginTop:marginTop},function(){
                showPrevNext(currentOffset);
            })
        }

        function next() {
            var marginTop = parseInt(jQuery("#rle_right_inner_left_inner").css("marginTop")) - marginTopGap;
            currentOffset = currentOffset+limit;
            jQuery("#rle_right_inner_left_inner").animate({marginTop:marginTop},function(){
                showPrevNext(currentOffset);
            })
        }

        jQuery("#rle_prev").unbind("click").click(function(){
            if(jQuery("#rle_prev").hasClass("active"))prev();
        })

        jQuery("#rle_next").unbind("click").click(function(){
            if(jQuery("#rle_next").hasClass("active"))next();
        })

        function showPrevNext(i) {
            if(currentOffset > 0) {
                jQuery("#rle_prev").addClass("active");
            } else {
                jQuery("#rle_prev").removeClass("active");
            }
            if(i+limit<annotations.length) {
                jQuery("#rle_next").addClass("active");
            } else {
                jQuery("#rle_next").removeClass("active");
            }
        }*/


        showAnnotation(offset);
        //showPrevNext(offset);
        highlightText(annotations);
    }

    function loadAnnotations() {

        function show() {
            if(!jQuery("#rle_annotation").is(":visible")) {
                setTimeout(show,20);
            } else {
                showAnnotations();
                jQuery("#rle_loader").fadeOut(200);
                _feedback.logAnnotate();
            }
        }

        jQuery.ajax({
            type:"POST",
            url:_options.url+"/"+_options.version+"/analysis/"+_options.analysis+"/enhance?key="+_options.key+"&out=json",
            data:jQuery("#rle_text").text().trim(),
            contentType:"text/plain",
            processData: false
        }).success(function(data) {
                //console.log(JSON.stringify(data));
                cleanData(data);
                show();
            }).error(function(){
                alert("could not load data");
            })
    }

    function changeConfidence(value) {
        jQuery("#rle_more_or_less").hide();
        jQuery("#rle_right_inner_left_inner").empty();
        loadAnnotations();
        jQuery("#rle_buttons").hide();
        jQuery("#rle_loader").css({opacity:0}).show().animate({opacity:1},100,function(){
            _text = jQuery("#rle_text").text().trim();
            jQuery("#rle_annotation").empty().text(_text);
            jQuery("#rle_text").hide();
            jQuery("#rle_button_annotate").hide();
            jQuery("#rle_loader").css({width:"500px"});
            jQuery("#conf_box").show();
            jQuery("#rle_annotation").show();
        });
    }

    function annotate() {
        jQuery("#rle_language").empty()
        jQuery("#rle_right_inner").css("margin-left","0");
        jQuery("#rle_more_or_less").hide();
        loadAnnotations();
        jQuery("#rle_buttons").hide();
        jQuery("#rle_loader").fadeIn(200,function(){
            _text = jQuery("#rle_text").text().trim();
            jQuery("#rle_annotation").empty().text(_text);
            jQuery("#rle_text").hide();
            jQuery("#rle_button_annotate").hide();
            jQuery("#rle_loader").animate({width:"500px"},300,"swing",function(){
                jQuery("#conf_box").show();
                jQuery("#rle_annotation").show();
            });
        });
    }

    function edit() {
        jQuery("#rle_language").empty();
        jQuery("#conf_box").hide();
        jQuery("#rle_right_inner").css("margin-left","0");
        jQuery("#rle_more_or_less").hide();
        jQuery("#rle_buttons").hide();
        jQuery("#rle_right_inner_left_inner").empty();
        jQuery("#rle_right_inner_right").empty();
        jQuery("#rle_loader").fadeIn(200,function(){
            jQuery("#rle_annotation").hide();
            jQuery("#rle_button_edit").hide();
            jQuery("#rle_loader").animate({width:"800px"},300,"swing",function(){
                jQuery("#rle_text").show();
                jQuery("#rle_loader").fadeOut(200);
                jQuery("#rle_button_annotate").show();
                jQuery("#rle_buttons").show();
            });
        });
        _feedback.logViewEdit();
    }

    //load view
    jQuery(_options.container).load(_options.template,function(val){

        jQuery("#rle_button_annotate").click(function(){
            annotate();
        }).text(_options.buttonTexts.annotate);

        jQuery("#rle_button_edit").click(function(){
            edit();
        }).text(_options.buttonTexts.edit);

        jQuery("#rle_text").html(_options.text);

        jQuery("#rle_loader > img").attr("src", _options.spinner);

        jQuery("#rle_slider").slider({
            range: "min",
            value: _options.confidence,
            min: 1,
            max: 100,
            slide: function( event, ui ) {
                jQuery("#rle_quality").text(ui.value + " %");
            },
            change: function( event, ui ) {
                changeConfidence(ui.value);
            }
        });

        jQuery("#rle_quality").text(jQuery("#rle_slider").slider("value") + " %");
 
   });
}

