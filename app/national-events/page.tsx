import Link from "next/link";
import { CalendarDays, ClipboardList, MapPin, ShieldCheck, Trophy, UsersRound } from "lucide-react";
import { PageHero } from "@/components/page-hero";

const tourStops = [
  {
    name: "第一站",
    date: "4月18日至19日",
    city: "江苏盐城",
    type: "分站赛",
    status: "已结束",
    qualifierHref: "/national-events/qualifiers",
    resultHref: "/national-events/results"
  },
  { name: "第二站", date: "5月3日至4日", city: "湖南娄底", type: "分站赛", status: "报名结束" },
  { name: "第三站", date: "5月30日至31日", city: "浙江丽水", type: "分站赛", status: "延期" },
  { name: "第四站", date: "6月13日至14日", city: "安徽天长", type: "分站赛" },
  { name: "第五站", date: "7月25日至26日", city: "陕西富平", type: "分站赛" },
  { name: "第六站", date: "9月12日至13日", city: "福建莆田", type: "分站赛" },
  { name: "第七站", date: "10月31日至11月1日", city: "湖北随州", type: "分站赛" },
  { name: "总决赛", date: "11月27日至29日", city: "北京", type: "总决赛" }
];

const individualGroups = [
  "二重奏魔方：U6组",
  "枫叶、二阶、三阶：U6、U9、U12、U18、成人组",
  "金字塔、斜转、镜面：U9、U12、U18、成人组",
  "三阶盲拧：U12、U18、成人组",
  "Redi、四阶、五阶、六阶、七阶：公开组"
];

const ageGroups = [
  "U6：2020年1月1日（含）以后出生",
  "U9：2017年1月1日-2019年12月31日出生",
  "U12：2014年1月1日-2016年12月31日出生",
  "U18：2008年1月1日-2013年12月31日出生",
  "成人组：2007年12月31日（含）以前出生",
  "公开组：不限年龄"
];

const registrationRules = [
  "通过地方体育行政部门、魔方协会、学校、培训主体等单位组织报名。",
  "每名选手分站赛限报1个组别个人全能赛、3项个人单项赛，可报2个组别团体接力赛。",
  "团体接力赛为5名队员+2名替补，混合组需至少含1名男性或1名女性选手。",
  "已取得总决赛名额的选手，不得在其他分站赛重复报名同一项目。"
];

const competitionRules = [
  "采用《中国魔方运动竞赛规则（试行）》。",
  "多人或多队同时参赛，赛前抽签确定分组和入场顺序。",
  "统一使用组委会提供赛具，三阶盲拧选手需自备眼罩。",
  "个人单项赛主项各项各组别冠军可获得总决赛资格。",
  "个人单项赛按3次平均评定，三阶盲拧按3次最快评定。",
  "个人全能和团体接力均按累计时间评定。"
];

export default function NationalEventsPage() {
  return (
    <>
      <PageHero
        label="国赛专题"
        title="2026年中国魔方运动巡回赛"
        actions={
          <>
            <Link className="button primary" href="/national-events/qualifiers">
              查看晋级名单
            </Link>
            <Link className="button" href="/national-events/results">
              查看全部成绩
            </Link>
            <Link className="button" href="https://www.mindsports.org.cn" target="_blank">
              中国智力运动网
            </Link>
          </>
        }
      >
        2026年巡回赛由7场分站赛与1场总决赛组成，本站先整理竞赛总规程摘要、赛历、项目组别、参赛办法与奖励规则，后续可继续补充各站通知和辽宁选手参赛记录。
      </PageHero>

      <section className="container section national-topic-section">
        <div className="national-overview">
          <div>
            <span className="eyebrow">竞赛总规程摘要</span>
            <h2>7站分站赛 + 1场总决赛</h2>
            <p>
              主办单位为国家体育总局棋牌运动管理中心、中国魔方运动工作委员会；承办单位为各地体育相关主管部门。
            </p>
          </div>
          <div className="national-stat-row">
            <div className="stat">
              <strong>7</strong>
              <span>分站赛</span>
            </div>
            <div className="stat">
              <strong>1</strong>
              <span>总决赛</span>
            </div>
            <div className="stat">
              <strong>2026</strong>
              <span>赛季</span>
            </div>
          </div>
        </div>

        <section className="national-block">
          <div className="section-header">
            <div>
              <span className="eyebrow">赛历</span>
              <h2>巡回赛站点</h2>
            </div>
          </div>
          <div className="national-stop-grid">
            {tourStops.map((stop) => (
              <div className={`national-stop ${stop.type === "总决赛" ? "final" : ""}`} key={stop.name}>
                <strong>{stop.name}</strong>
                <span>{stop.type}</span>
                <p>
                  <CalendarDays size={15} />
                  {stop.date}
                </p>
                <p>
                  <MapPin size={15} />
                  {stop.city}
                </p>
                {stop.status ? <span className="national-stop-status">{stop.status}</span> : null}
                {stop.qualifierHref ? (
                  <div className="national-stop-actions">
                    <Link className="national-stop-link active" href={stop.qualifierHref}>
                      查看晋级名单
                    </Link>
                    {stop.resultHref ? (
                      <Link className="national-stop-link active" href={stop.resultHref}>
                        查看全部成绩
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="national-layout">
          <div className="national-info-block">
            <div className="national-block-title">
              <ClipboardList size={20} />
              <h2>竞赛项目</h2>
            </div>
            <h3>个人单项赛</h3>
            <ul>
              {individualGroups.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h3>个人全能赛</h3>
            <p>枫叶魔方 + 金字塔魔方 + 二阶魔方 + 三阶魔方 + 镜面魔方，设男子组和女子组，限时300秒。</p>
            <h3>团体接力赛</h3>
            <p>枫叶魔方 → 金字塔魔方 → 二阶魔方 → 三阶魔方 → 镜面魔方，设男子组、女子组、混合组，限时300秒。</p>
          </div>

          <div className="national-info-block">
            <div className="national-block-title">
              <UsersRound size={20} />
              <h2>参赛办法</h2>
            </div>
            <h3>年龄组别</h3>
            <ul>
              {ageGroups.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h3>报名要求</h3>
            <ul>
              {registrationRules.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="national-layout">
          <div className="national-info-block">
            <div className="national-block-title">
              <ShieldCheck size={20} />
              <h2>竞赛办法</h2>
            </div>
            <ul>
              {competitionRules.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p>
              除三阶盲拧、团体接力赛无观察时间外，其余项目观察时间上限15秒。比赛按照每次或每轮最终成绩排名，时间短者为获胜方。
            </p>
          </div>

          <div className="national-info-block">
            <div className="national-block-title">
              <Trophy size={20} />
              <h2>录取名次与奖励</h2>
            </div>
            <ul>
              <li>分站赛各赛各组别录取前6名（队），颁发获奖证书和纪念魔方，并取得总决赛晋级资格。</li>
              <li>总决赛各赛各组别录取前3名，颁发奖牌、获奖证书和纪念魔方。</li>
              <li>个人全能赛第二阶段冠亚季军奖金分别为3万元、1万元、0.5万元，4-8名颁发获奖证书。</li>
              <li>团体接力赛各组别冠军获得1.5万元奖金。</li>
              <li>总决赛破2025年巡回赛总决赛全国纪录者可获得纪录证书和5000元奖金。</li>
            </ul>
          </div>
        </section>

        <section className="national-note-band">
          <div>
            <h2>报名、报到与材料</h2>
            <p>
              基础费用200元/人；个人单项赛20元/项，个人全能赛40元/人，团体接力赛50元/队。报名需通过中国智力运动网进行，并按各站补充通知提交盖章报名表。
            </p>
          </div>
          <ul>
            <li>本人第二代居民身份证或户口本复印件。</li>
            <li>选手签字的自愿参赛承诺书，未满十八周岁需监护人签字。</li>
            <li>人身意外伤害险保单复印件或扫描件。</li>
          </ul>
        </section>
      </section>
    </>
  );
}
